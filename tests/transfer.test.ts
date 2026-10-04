import test from 'node:test';
import assert from 'node:assert/strict';
import { SignalStore } from '../src/lib/transfer/signaling-store';
import { PhotoAssembler, parseHeader, hashBytes, CHUNK_SIZE } from '../src/lib/transfer/protocol';
import { setPhoto, setResult, getPhoto, getResult, clearSession, registerSessionCleanup } from '../src/lib/session';
import { failure, readBody } from '../src/lib/transfer/http';

const offer = { type: 'offer', sdp: 'v=0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n' };
test('only the owner can publish an offer or revoke the room', () => {
  const store = new SignalStore();
  const room = store.create();
  assert.throws(() => store.operate(room.id, 'wrong', { op: 'poll' }), /권한/);
  assert.throws(() => store.operate(room.id, room.receiverToken, { op: 'offer', clientId: 'phone-one', description: offer }), /권한/);
  store.operate(room.id, room.ownerToken, { op: 'close' });
  assert.throws(() => store.operate(room.id, room.receiverToken, { op: 'poll' }), /만료/);
});
test('one receiver at a time; offers and answers never cross receiver generations', () => {
  let now = 0;
  const store = new SignalStore(() => now);
  const room = store.create();
  store.operate(room.id, room.receiverToken, { op: 'claim', clientId: 'phone-one' });
  assert.throws(() => store.operate(room.id, room.receiverToken, { op: 'claim', clientId: 'phone-two' }), /다른 휴대폰/);
  store.operate(room.id, room.ownerToken, { op: 'offer', clientId: 'phone-one', description: offer });
  now = 16000;
  store.operate(room.id, room.receiverToken, { op: 'claim', clientId: 'phone-two' });
  const snapshot = store.operate(room.id, room.receiverToken, { op: 'poll', clientId: 'phone-two' });
  assert.equal(snapshot.offer, null);
  assert.throws(() => store.operate(room.id, room.ownerToken, { op: 'offer', clientId: 'phone-one', description: offer }), /연결이 변경/);
});
test('rooms expire without owner heartbeat; reads by a receiver cannot keep them alive', () => {
  let now = 0;
  const store = new SignalStore(() => now);
  const room = store.create();
  store.operate(room.id, room.receiverToken, { op: 'claim', clientId: 'phone-one' });
  now = 181000;
  assert.throws(() => store.operate(room.id, room.receiverToken, { op: 'poll', clientId: 'phone-one' }), /만료/);
});
test('the signaling server rejects photographs and non-signaling payloads', () => {
  const store = new SignalStore();
  const room = store.create();
  store.operate(room.id, room.receiverToken, { op: 'claim', clientId: 'phone-one' });
  assert.throws(() => store.operate(room.id, room.ownerToken, { op: 'offer', clientId: 'phone-one', description: { type: 'offer', sdp: 'data:image/jpeg;base64,AAAA' } }), /연결 정보/);
  assert.throws(() => store.operate(room.id, room.ownerToken, { op: 'poll', image: 'data:image/jpeg;base64,AAAA' }), /연결 정보/);
});
test('a complete image is verified; missing, corrupted or oversized chunks are rejected', async () => {
  const bytes = new Uint8Array(50_000).map((_, i) => i % 251).buffer;
  const header = { kind: 'photo' as const, mime: 'image/jpeg', size: bytes.byteLength, sha256: await hashBytes(bytes), meta: { id: 'test-photo', frameId: 'festival', createdAt: new Date().toISOString() } };
  const receiver = new PhotoAssembler(header);
  for (let i = 0; i < bytes.byteLength; i += CHUNK_SIZE) receiver.add(bytes.slice(i, i + CHUNK_SIZE));
  assert.deepEqual(await (await receiver.finish()).arrayBuffer(), bytes);
  const missing = new PhotoAssembler(header);
  missing.add(bytes.slice(0, CHUNK_SIZE));
  await assert.rejects(() => missing.finish(), /모두 받지/);
  const corrupt = new PhotoAssembler({ ...header, sha256: '0'.repeat(64) });
  for (let i = 0; i < bytes.byteLength; i += CHUNK_SIZE) corrupt.add(bytes.slice(i, i + CHUNK_SIZE));
  await assert.rejects(() => corrupt.finish(), /확인에 실패/);
  assert.throws(() => new PhotoAssembler(header).add(bytes), /전송이 올바르지/);
  assert.throws(() => parseHeader({ ...header, mime: 'image/svg+xml' }), /올바르지/);
  assert.throws(() => parseHeader({ ...header, size: 21_000_000 }), /올바르지/);
});
test('restart clears original and generated photographs and stops active senders', () => {
  setPhoto('private-original'); setResult('private-result');
  let closed = 0;
  const unregister = registerSessionCleanup(() => closed++);
  clearSession(); unregister();
  assert.equal(closed, 1);
  assert.equal(getPhoto(), null); assert.equal(getResult(), null);
});
test('same-origin signaling works behind the Next host alias; cross-site requests are denied', async () => {
  const make = (origin: string) => new Request('http://localhost:3012/api/transfer', { method: 'POST', headers: { host: '127.0.0.1:3012', origin, 'content-type': 'application/json' }, body: '{}' });
  assert.deepEqual(await readBody(make('http://127.0.0.1:3012')), {});
  await assert.rejects(() => readBody(make('https://untrusted.example')), /권한/);
});
test('cleanup failures cannot prevent photographs being discarded', () => {
  setPhoto('private-original'); setResult('private-result');
  const unregister = registerSessionCleanup(() => { throw new Error('Connection already closed'); });
  assert.doesNotThrow(clearSession); unregister();
  assert.equal(getPhoto(), null); assert.equal(getResult(), null);
});

test('expired-room errors keep their status across independently loaded route modules', async () => {
  // Next bundles API routes separately while the room store survives on globalThis.
  const otherRoute = await import(new URL('../src/lib/transfer/signaling-store.ts?route=receiver', import.meta.url).href);
  assert.notEqual(otherRoute.SignalStore, SignalStore);
  const store = new otherRoute.SignalStore();
  const room = store.create();
  store.operate(room.id, room.ownerToken, { op: 'close' });
  let error: unknown;
  try { store.operate(room.id, room.receiverToken, { op: 'claim', clientId: 'phone-one' }); }
  catch (caught) { error = caught; }
  const response = failure(error);
  assert.equal(response.status, 410);
  assert.match((await response.json()).error, /연결이 만료됐어요/);
  assert.equal(failure(new Error('internal details')).status, 500);
});

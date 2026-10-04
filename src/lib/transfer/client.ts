'use client';
import type { LivePhotoMeta } from '../live-photo';
import { CHUNK_SIZE, CompareAssembler, MAX_IMAGE_BYTES, PhotoAssembler, hashBytes, parseCompareHeader, parseHeader, type CompareHeader, type PhotoHeader } from './protocol';
import { registerSessionCleanup } from '../session';

export type TransferState = { status: 'waiting' | 'connecting' | 'sending' | 'received' | 'error'; progress?: number; message?: string };
/** Display-only images for the phone's before/after slider; never offered for download. */
export type ComparePair = { before: string; after: string };
type Room = { id: string; ownerToken: string; receiverToken: string; iceServers: RTCIceServer[]; hasTurn: boolean };
type Signal = { receiverId: string | null; offer: RTCSessionDescriptionInit | null; answer: RTCSessionDescriptionInit | null; iceServers?: RTCIceServer[] };
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
class ConnectionRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export const connectionError = '휴대폰과 연결하지 못했어요. 같은 Wi-Fi에서 다시 시도하거나 운영자에게 문의해 주세요.';
function checkSupport() {
  if (!window.isSecureContext || !window.RTCPeerConnection || !crypto.subtle) throw new Error('사진 전달은 HTTPS 주소에서 사용할 수 있어요.');
}
async function post<T>(url: string, body: unknown, token?: string, keepalive = false): Promise<T> {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body), cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(12_000), keepalive });
  const data = await response.json();
  if (!response.ok) throw new ConnectionRequestError(data.error || '연결을 준비하지 못했어요. 다시 시도해 주세요.', response.status);
  return data as T;
}
async function gather(peer: RTCPeerConnection, description: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
  await peer.setLocalDescription(description);
  const deadline = Date.now() + 8_000;
  while (peer.iceGatheringState !== 'complete' && Date.now() < deadline) {
    if (peer.signalingState === 'closed') throw new Error('연결이 종료됐어요.');
    await wait(100);
  }
  if (!peer.localDescription) throw new Error(connectionError);
  return { type: peer.localDescription.type, sdp: peer.localDescription.sdp };
}
async function sendPhoto(channel: RTCDataChannel, image: string, meta: Omit<LivePhotoMeta, 'photoUrl'>, active: () => boolean, update: (value: TransferState) => void, compare: boolean) {
  const blob = await (await fetch(image)).blob();
  if (!blob.size || blob.size > MAX_IMAGE_BYTES) throw new Error('사진이 너무 커서 전달하지 못했어요. 저장 버튼을 이용해 주세요.');
  const bytes = await blob.arrayBuffer();
  const header: PhotoHeader = { kind: 'photo', size: bytes.byteLength, mime: blob.type, sha256: await hashBytes(bytes), meta, ...(compare ? { compare: true as const } : {}) };
  parseHeader(header);
  if (!active()) return;
  channel.send(JSON.stringify(header));
  for (let offset = 0; offset < bytes.byteLength; offset += CHUNK_SIZE) {
    const deadline = Date.now() + 10_000;
    while (channel.bufferedAmount > 256_000) {
      if (!active() || channel.readyState !== 'open') return;
      if (Date.now() > deadline) throw new Error(connectionError);
      await wait(25);
    }
    if (!active() || channel.readyState !== 'open') return;
    channel.send(bytes.slice(offset, offset + CHUNK_SIZE));
    update({ status: 'sending', progress: Math.min(99, Math.round((offset + CHUNK_SIZE) / bytes.byteLength * 100)) });
  }
  channel.send(JSON.stringify({ kind: 'end' }));
  return true;
}
/**
 * Sends the before/after pair after the photo. It never touches the booth's status: the
 * photo is already delivered, and a lost pair only hides the phone's comparison button.
 */
async function sendCompare(channel: RTCDataChannel, pair: ComparePair, active: () => boolean) {
  for (const role of ['before', 'after'] as const) {
    const blob = await (await fetch(pair[role])).blob();
    const bytes = await blob.arrayBuffer();
    const header: CompareHeader = { kind: 'compare', role, size: bytes.byteLength, mime: blob.type, sha256: await hashBytes(bytes) };
    parseCompareHeader(header);
    if (!active() || channel.readyState !== 'open') return;
    channel.send(JSON.stringify(header));
    for (let offset = 0; offset < bytes.byteLength; offset += CHUNK_SIZE) {
      const deadline = Date.now() + 10_000;
      while (channel.bufferedAmount > 256_000) {
        if (!active() || channel.readyState !== 'open' || Date.now() > deadline) return;
        await wait(25);
      }
      if (!active() || channel.readyState !== 'open') return;
      channel.send(bytes.slice(offset, offset + CHUNK_SIZE));
    }
    channel.send(JSON.stringify({ kind: 'end' }));
  }
}

export class PhotoSender {
  private peer: RTCPeerConnection | null = null;
  private image: string | null;
  private compare: ComparePair | null;
  private disposed = false;
  private clientId: string | null = null;
  private acceptedAnswer = false;
  private generation = 0;
  private unregister = () => {};
  private completed = false;
  private started = 0;
  private constructor(public room: Room, image: string, private meta: Omit<LivePhotoMeta, 'photoUrl'>, private update: (value: TransferState) => void, compare?: ComparePair) {
    this.image = image;
    this.compare = compare ?? null;
    this.unregister = registerSessionCleanup(() => this.close());
    window.addEventListener('pagehide', this.pagehide);
    void this.poll();
  }
  static async create(image: string, meta: Omit<LivePhotoMeta, 'id' | 'createdAt' | 'photoUrl'>, update: (value: TransferState) => void, compare?: ComparePair) {
    checkSupport();
    const room = await post<Room>('/api/transfer', {});
    return new PhotoSender(room, image, { ...meta, id: room.id, createdAt: new Date().toISOString() }, update, compare);
  }
  get url() { return window.location.origin + '/receive/' + this.room.id + '#' + this.room.receiverToken; }
  private signal(body: unknown, keepalive = false) { return post<Signal>('/api/transfer/' + this.room.id, body, this.room.ownerToken, keepalive); }
  private pagehide = () => this.close();
  close() {
    if (this.disposed) return;
    this.disposed = true; this.generation++; this.image = null; this.compare = null;
    this.peer?.close(); this.peer = null;
    this.unregister(); window.removeEventListener('pagehide', this.pagehide);
    void this.signal({ op: 'close' }, true).catch(() => {});
  }
  private async connect(clientId: string) {
    this.peer?.close();
    const generation = ++this.generation;
    const peer = this.peer = new RTCPeerConnection({ iceServers: this.room.iceServers });
    this.clientId = clientId; this.acceptedAnswer = false; this.completed = false; this.started = Date.now();
    const active = () => !this.disposed && this.generation === generation;
    const update = (state: TransferState) => { if (active()) this.update(state); };
    update({ status: 'connecting' });
    const channel = peer.createDataChannel('photo', { ordered: true });
    channel.onopen = () => {
      if (!active() || !this.image) return;
      update({ status: 'sending', progress: 0 });
      const compare = this.compare;
      void sendPhoto(channel, this.image, this.meta, active, update, !!compare)
        .then((sent) => { if (sent && compare) void sendCompare(channel, compare, active).catch(() => {}); })
        .catch((e) => update({ status: 'error', message: e.message }));
    };
    channel.onmessage = (event) => {
      if (!active() || typeof event.data !== 'string') return;
      try {
        if (JSON.parse(event.data).kind === 'received') { this.completed = true; update({ status: 'received', progress: 100 }); }
      } catch { /* Ignore unknown acknowledgments. */ }
    };
    channel.onclose = () => { if (!this.completed) update({ status: 'error', message: connectionError }); };
    peer.onconnectionstatechange = () => { if (peer.connectionState === 'failed') update({ status: 'error', message: connectionError }); };
    const offer = await gather(peer, await peer.createOffer());
    if (active()) await this.signal({ op: 'offer', clientId, description: offer });
  }
  private async poll() {
    let failures = 0;
    while (!this.disposed) {
      try {
        const state = await this.signal({ op: 'poll' });
        if (this.disposed) return;
        failures = 0;
        if (state.receiverId && state.receiverId !== this.clientId) await this.connect(state.receiverId);
        if (!state.receiverId && this.clientId) { this.generation++; this.peer?.close(); this.peer = null; this.clientId = null; this.started = 0; if (!this.completed) this.update({ status: 'waiting' }); }
        if (state.answer && !this.acceptedAnswer && this.peer && state.receiverId === this.clientId) {
          this.acceptedAnswer = true;
          await this.peer.setRemoteDescription(state.answer);
        }
        if (this.started && !this.completed && Date.now() - this.started > 90_000) { this.update({ status: 'error', message: connectionError }); this.started = 0; this.peer?.close(); }
      } catch (e) {
        if (this.disposed) return;
        if (++failures >= 3) { this.update({ status: 'error', message: e instanceof Error ? e.message : connectionError }); this.close(); return; }
      }
      await wait(1_000);
    }
  }
}

export function receivePhoto(id: string, token: string, update: (value: TransferState) => void, received: (blob: Blob, meta: Omit<LivePhotoMeta, 'photoUrl'>) => void, compared?: (pair: { before: Blob; after: Blob }) => void) {
  let disposed = false, done = false;
  let peer: RTCPeerConnection | null = null;
  let assembler: PhotoAssembler | null = null;
  // After the photo is acknowledged, the optional before/after pair is collected here.
  let awaitingCompare = false;
  let compareAssembler: CompareAssembler | null = null;
  let compareTimer: ReturnType<typeof setTimeout> | undefined;
  const pair: { before?: Blob; after?: Blob } = {};
  const clientId = crypto.randomUUID();
  const signal = (body: unknown, keepalive = false) => post<Signal>('/api/transfer/' + id, { ...body as object, clientId }, token, keepalive);
  const close = () => {
    if (disposed) return;
    disposed = true; assembler?.clear(); assembler = null; peer?.close(); peer = null;
    awaitingCompare = false; compareAssembler?.clear(); compareAssembler = null; clearTimeout(compareTimer);
    window.removeEventListener('pagehide', close);
    void signal({ op: 'release' }, true).catch(() => {});
  };
  const fail = (error: unknown) => { if (!disposed && !done) { update({ status: 'error', message: error instanceof Error ? error.message : connectionError }); close(); } };
  window.addEventListener('pagehide', close);
  void (async () => {
    checkSupport();
    if (!/^[A-Za-z0-9_-]{32}$/.test(id) || !/^[A-Za-z0-9_-]{32}$/.test(token)) throw new Error('QR 연결 정보가 없어요. 부스의 QR을 다시 찍어 주세요.');
    let claim: Signal;
    const claimDeadline = Date.now() + 16_000;
    while (true) {
      if (disposed) return;
      try { claim = await signal({ op: 'claim' }); break; }
      catch (error) {
        if (!(error instanceof ConnectionRequestError && error.status === 409) || Date.now() >= claimDeadline) throw error;
        await wait(500);
      }
    }
    // A component can unmount while its claim request is still in flight (Strict Mode
    // or a quick navigation). Release the now-confirmed claim rather than orphan it.
    if (disposed) { void signal({ op: 'release' }, true).catch(() => {}); return; }
    peer = new RTCPeerConnection({ iceServers: claim.iceServers });
    update({ status: 'connecting' });
    let offerAccepted = false;
    // A single ordered promise chain prevents async digest/Blob conversions racing packets.
    let packets = Promise.resolve();
    // Comparison images are optional: any problem just closes the finished connection.
    const takeCompare = async (data: unknown) => {
      try {
        if (typeof data === 'string') {
          if (data.length > 4_000) throw new Error('compare header too long');
          const message = JSON.parse(data);
          if (message.kind === 'compare' && !compareAssembler) compareAssembler = new CompareAssembler(message);
          else if (message.kind === 'end' && compareAssembler) {
            const role = compareAssembler.header.role;
            const blob = await compareAssembler.finish();
            compareAssembler = null;
            const url = URL.createObjectURL(blob);
            try { const img = new Image(); img.src = url; await img.decode(); } finally { URL.revokeObjectURL(url); }
            if (disposed) return;
            pair[role] = blob;
            if (pair.before && pair.after) {
              awaitingCompare = false; clearTimeout(compareTimer);
              compared?.({ before: pair.before, after: pair.after });
              setTimeout(close, 300);
            }
          } else throw new Error('compare order');
        } else if (data instanceof ArrayBuffer && compareAssembler) compareAssembler.add(data);
        else throw new Error('compare data');
      } catch {
        close();
      }
    };
    peer.ondatachannel = ({ channel }) => {
      channel.binaryType = 'arraybuffer';
      channel.onclose = () => { if (!done) fail(new Error('전송이 중단됐어요. 부스 화면을 확인하고 다시 받아 주세요.')); };
      channel.onerror = () => fail(new Error(connectionError));
      channel.onmessage = ({ data }) => {
        packets = packets.then(async () => {
          if (disposed) return;
          if (done) { if (awaitingCompare) await takeCompare(data); return; }
          if (typeof data === 'string') {
            if (data.length > 4_000) throw new Error('사진 전달 정보가 올바르지 않아요.');
            const message = JSON.parse(data);
            if (message.kind === 'photo') {
              if (assembler) throw new Error('사진 전달 정보가 올바르지 않아요.');
              assembler = new PhotoAssembler(parseHeader(message));
              update({ status: 'sending', progress: 0 });
            } else if (message.kind === 'end' && assembler) {
              const meta = assembler.header.meta;
              const expectCompare = assembler.header.compare === true && !!compared;
              const blob = await assembler.finish();
              assembler = null;
              if (disposed) return;
              // Decode before acknowledging: a complete but invalid image is not success.
              const url = URL.createObjectURL(blob);
              try { const img = new Image(); img.src = url; await img.decode(); } finally { URL.revokeObjectURL(url); }
              if (disposed) return;
              channel.send(JSON.stringify({ kind: 'received' }));
              done = true; received(blob, meta); update({ status: 'received', progress: 100 });
              if (expectCompare) {
                // The comparison pair follows; give up quietly if it does not arrive.
                awaitingCompare = true;
                compareTimer = setTimeout(close, 20_000);
              } else {
                // Allow the acknowledgment to drain before releasing the encrypted channel.
                setTimeout(close, 1_000);
              }
            } else throw new Error('사진 전달 순서가 올바르지 않아요.');
          } else if (data instanceof ArrayBuffer && assembler) update({ status: 'sending', progress: assembler.add(data) });
          else throw new Error('사진 전달 정보가 올바르지 않아요.');
        }).catch(fail);
      };
    };
    const deadline = Date.now() + 90_000;
    let failures = 0;
    while (!disposed && !done) {
      if (Date.now() > deadline) throw new Error(connectionError);
      try {
        const state = await signal({ op: 'poll' }); failures = 0;
        if (disposed) return;
        if (state.offer && !offerAccepted) {
          offerAccepted = true;
          await peer.setRemoteDescription(state.offer);
          const answer = await gather(peer, await peer.createAnswer());
          if (!disposed) await signal({ op: 'answer', description: answer });
        }
      } catch (e) { if (++failures >= 3) throw e; }
      await wait(1_000);
    }
  })().catch(fail);
  return close;
}

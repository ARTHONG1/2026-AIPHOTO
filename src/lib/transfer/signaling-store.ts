import { randomBytes, timingSafeEqual } from 'node:crypto';

type Description = { type: 'offer' | 'answer'; sdp: string };
type Room = {
  id: string; ownerToken: string; receiverToken: string; created: number; ownerSeen: number;
  receiverId: string | null; receiverSeen: number; offer: Description | null; answer: Description | null;
};
const signalErrorBrand = Symbol.for('photobooth.signal-error');
export class SignalError extends Error {
  readonly [signalErrorBrand] = true;
  constructor(message: string, public status = 400) { super(message); }
  static is(error: unknown): error is SignalError {
    return error instanceof Error && signalErrorBrand in error && error[signalErrorBrand] === true;
  }
}
const secret = () => randomBytes(24).toString('base64url');
const equal = (a: string, b: string) => /^[A-Za-z0-9_-]{32}$/.test(a) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const OWNER_TTL = 180_000;
const MAX_LIFETIME = 30 * 60_000;
const LEASE = 15_000;

// Connection metadata ONLY. No photograph, file, bucket, database or persistent log.
export class SignalStore {
  private rooms = new Map<string, Room>();
  constructor(private now: () => number = Date.now) {}
  prune() {
    const now = this.now();
    for (const [id, room] of this.rooms) {
      if (now - room.ownerSeen > OWNER_TTL || now - room.created > MAX_LIFETIME) this.rooms.delete(id);
    }
  }
  create() {
    this.prune();
    if (this.rooms.size >= 200) throw new SignalError('연결이 많아요. 잠시 후 다시 시도해 주세요.', 503);
    const now = this.now();
    const room: Room = { id: secret(), ownerToken: secret(), receiverToken: secret(), created: now, ownerSeen: now, receiverId: null, receiverSeen: 0, offer: null, answer: null };
    this.rooms.set(room.id, room);
    return { id: room.id, ownerToken: room.ownerToken, receiverToken: room.receiverToken };
  }
  operate(id: string, token: string, body: Record<string, unknown>) {
    this.prune();
    const room = this.rooms.get(id);
    if (!room) throw new SignalError('연결이 만료됐어요. 부스에서 QR을 다시 만들어 주세요.', 410);
    const owner = equal(token, room.ownerToken);
    if (!owner && !equal(token, room.receiverToken)) throw new SignalError('연결 권한이 없어요.', 403);
    const { op, clientId } = body;
    if (Object.keys(body).some((key) => !['op', 'clientId', 'description'].includes(key))) throw new SignalError('올바른 연결 정보가 아닙니다.');
    if (!['poll', 'claim', 'offer', 'answer', 'close', 'release'].includes(String(op))) throw new SignalError('올바른 연결 정보가 아닙니다.');
    if ((op === 'offer' && !owner) || (op === 'answer' && owner)) throw new SignalError('연결 권한이 없어요.', 403);
    if (owner) room.ownerSeen = this.now();
    if (op === 'close') {
      if (!owner) throw new SignalError('연결 권한이 없어요.', 403);
      this.rooms.delete(id);
      return { closed: true };
    }
    if (op === 'claim') {
      if (owner || typeof clientId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(clientId)) throw new SignalError('올바른 연결 정보가 아닙니다.');
      if (room.receiverId !== clientId && room.receiverId && this.now() - room.receiverSeen < LEASE) throw new SignalError('다른 휴대폰에 전달 중이에요. 잠시 후 다시 시도해 주세요.', 409);
      if (room.receiverId !== clientId) { room.receiverId = clientId; room.offer = null; room.answer = null; }
      room.receiverSeen = this.now();
    } else if (!owner) {
      if (!room.receiverId || clientId !== room.receiverId) throw new SignalError('휴대폰 연결이 변경됐어요. 다시 연결해 주세요.', 409);
      room.receiverSeen = this.now();
    }
    if (op === 'release') {
      if (owner) throw new SignalError('연결 권한이 없어요.', 403);
      room.receiverId = null; room.offer = null; room.answer = null;
    }
    if (op === 'offer' || op === 'answer') {
      if ((op === 'offer') !== owner) throw new SignalError('연결 권한이 없어요.', 403);
      if (clientId !== room.receiverId || !room.receiverId) throw new SignalError('휴대폰 연결이 변경됐어요.', 409);
      const desc = body.description as Description | undefined;
      if (!desc || Object.keys(desc).some((key) => !['type', 'sdp'].includes(key)) || desc.type !== op || typeof desc.sdp !== 'string' || desc.sdp.length > 24_000 || !desc.sdp.startsWith('v=0') || !desc.sdp.includes('m=application') || /data:|base64|m=(audio|video)/i.test(desc.sdp)) throw new SignalError('올바른 연결 정보가 아닙니다.');
      room[op] = { type: desc.type, sdp: desc.sdp };
    }
    return { receiverId: room.receiverId, offer: room.offer, answer: room.answer };
  }
}

// Keep one store through development hot reloads and the Next route bundles.
const globalStore = globalThis as typeof globalThis & { photoboothSignals?: SignalStore; photoboothSignalTimer?: ReturnType<typeof setInterval> };
export const signalStore = globalStore.photoboothSignals ??= new SignalStore();
if (!globalStore.photoboothSignalTimer) {
  globalStore.photoboothSignalTimer = setInterval(() => signalStore.prune(), 30_000);
  globalStore.photoboothSignalTimer.unref();
}

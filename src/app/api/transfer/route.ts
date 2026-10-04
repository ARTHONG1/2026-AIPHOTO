import { signalStore, SignalError } from '@/lib/transfer/signaling-store';
import { failure, iceServers, json, readBody } from '@/lib/transfer/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    if (Object.keys(body).length) throw new SignalError('올바른 연결 정보가 아닙니다.');
    return json({ ...signalStore.create(), iceServers: iceServers(), hasTurn: Boolean(process.env.PHOTOBOOTH_TURN_URLS && process.env.PHOTOBOOTH_TURN_USERNAME && process.env.PHOTOBOOTH_TURN_CREDENTIAL) });
  } catch (error) { return failure(error); }
}

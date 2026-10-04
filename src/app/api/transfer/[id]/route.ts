import { signalStore } from '@/lib/transfer/signaling-store';
import { failure, iceServers, json, readBody } from '@/lib/transfer/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await readBody(request);
    const { id } = await params;
    const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
    return json({ ...signalStore.operate(id, token, body), ...(body.op === 'claim' ? { iceServers: iceServers() } : {}) });
  } catch (error) { return failure(error); }
}

import { SignalError } from './signaling-store';

export const privateHeaders = { 'Cache-Control': 'no-store, private, max-age=0', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
export function json(value: unknown, status = 200) { return Response.json(value, { status, headers: privateHeaders }); }
export function failure(error: unknown) {
  // The global room store may come from another Next route bundle or hot reload.
  return SignalError.is(error) ? json({ error: error.message }, error.status) : json({ error: '연결을 준비하지 못했어요. 다시 시도해 주세요.' }, 500);
}
export async function readBody(request: Request) {
  const origin = request.headers.get('origin');
  // Next normalizes request.url to its bind hostname; reverse proxies also rewrite it.
  // Compare the browser's origin with the externally addressed host, not localhost.
  const host = request.headers.get('x-forwarded-host')?.split(',')[0].trim() || request.headers.get('host') || new URL(request.url).host;
  if (origin) {
    let source: URL;
    try { source = new URL(origin); } catch { throw new SignalError('연결 권한이 없어요.', 403); }
    if (!['http:', 'https:'].includes(source.protocol) || source.host !== host) throw new SignalError('연결 권한이 없어요.', 403);
  }
  if (request.headers.get('sec-fetch-site') === 'cross-site') throw new SignalError('연결 권한이 없어요.', 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new SignalError('올바른 연결 정보가 아닙니다.', 415);
  // Bound the actual stream as well as Content-Length; never accept an image upload.
  const reader = request.body?.getReader();
  if (!reader) throw new SignalError('올바른 연결 정보가 아닙니다.');
  const chunks: Uint8Array[] = []; let bytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 32_000) { await reader.cancel(); throw new SignalError('연결 정보가 너무 큽니다.', 413); }
    chunks.push(value);
  }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new SignalError('올바른 연결 정보가 아닙니다.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new SignalError('올바른 연결 정보가 아닙니다.');
  return body as Record<string, unknown>;
}
export function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  // Use time-limited credentials from your TURN provider for public/mobile networks.
  const urls = process.env.PHOTOBOOTH_TURN_URLS?.split(',').map((s) => s.trim()).filter(Boolean);
  if (urls?.length && process.env.PHOTOBOOTH_TURN_USERNAME && process.env.PHOTOBOOTH_TURN_CREDENTIAL) {
    servers.push({ urls, username: process.env.PHOTOBOOTH_TURN_USERNAME, credential: process.env.PHOTOBOOTH_TURN_CREDENTIAL });
  }
  return servers;
}

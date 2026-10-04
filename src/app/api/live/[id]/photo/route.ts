// Legacy storage proxy is retired. No external image fetch or upload is performed.
export async function GET() {
  return new Response('사진을 서버에 보관하지 않습니다.', { status: 410, headers: { 'Cache-Control': 'no-store, private' } });
}

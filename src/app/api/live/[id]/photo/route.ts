import { STORAGE_BASE_URL } from '@/lib/storage';

// The storage bucket sends no CORS headers, so phones refuse to draw its photos on a
// canvas. Serving the photo from the app's own origin keeps the live view and the
// video recording working without changing the bucket.
const ID_PATTERN = /^[A-Za-z0-9_-]{4,32}$/;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) return new Response('Not found', { status: 404 });

  const upstream = await fetch(STORAGE_BASE_URL + '/photos/' + id + '/photo.jpg', { cache: 'no-store' }).catch(() => null);
  if (!upstream?.ok || !upstream.body) return new Response('Not found', { status: 404 });

  return new Response(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

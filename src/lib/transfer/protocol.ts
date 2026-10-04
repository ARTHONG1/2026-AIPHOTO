import type { LivePhotoMeta } from '../live-photo';
export const MAX_IMAGE_BYTES = 20_000_000;
export const CHUNK_SIZE = 16_384;
export type PhotoHeader = { kind: 'photo'; size: number; mime: string; sha256: string; meta: Omit<LivePhotoMeta, 'photoUrl'> };
export function parseHeader(value: unknown): PhotoHeader {
  const h = value as PhotoHeader;
  const meta = h?.meta;
  const id = (v: unknown) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
  if (!h || h.kind !== 'photo' || !Number.isInteger(h.size) || h.size <= 0 || h.size > MAX_IMAGE_BYTES || !['image/jpeg', 'image/png', 'image/webp'].includes(h.mime) || !/^[a-f0-9]{64}$/.test(h.sha256) || !meta || !id(meta.id) || !id(meta.frameId) || typeof meta.createdAt !== 'string' || meta.createdAt.length > 40 || ['backgroundId', 'poseId', 'compositionId'].some((key) => meta[key as keyof typeof meta] !== undefined && !id(meta[key as keyof typeof meta])) || (meta.propIds !== undefined && (!Array.isArray(meta.propIds) || meta.propIds.length > 3 || !meta.propIds.every(id)))) throw new Error('사진 전달 정보가 올바르지 않아요. 다시 받아 주세요.');
  return h;
}
export async function hashBytes(bytes: ArrayBuffer) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export class PhotoAssembler {
  private chunks: ArrayBuffer[] = [];
  private size = 0;
  constructor(public header: PhotoHeader) { parseHeader(header); }
  add(chunk: ArrayBuffer) {
    if (!chunk.byteLength || chunk.byteLength > CHUNK_SIZE || this.size + chunk.byteLength > this.header.size) throw new Error('사진 전송이 올바르지 않아요. 다시 받아 주세요.');
    this.chunks.push(chunk); this.size += chunk.byteLength;
    return Math.round(this.size / this.header.size * 100);
  }
  async finish() {
    if (this.size !== this.header.size) throw new Error('사진을 모두 받지 못했어요. 다시 받아 주세요.');
    const blob = new Blob(this.chunks, { type: this.header.mime });
    this.clear();
    if (await hashBytes(await blob.arrayBuffer()) !== this.header.sha256) throw new Error('사진 확인에 실패했어요. 다시 받아 주세요.');
    return blob;
  }
  clear() { this.chunks = []; this.size = 0; }
}

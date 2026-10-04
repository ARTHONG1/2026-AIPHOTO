import type { LivePhotoMeta } from '../live-photo';
export const MAX_IMAGE_BYTES = 20_000_000;
/** Display-only before/after images sent after the photo for the comparison slider. */
export const MAX_COMPARE_BYTES = 4_000_000;
export const CHUNK_SIZE = 16_384;
/** `compare` tells the phone that a before/after pair follows the photo. */
export type PhotoHeader = { kind: 'photo'; size: number; mime: string; sha256: string; meta: Omit<LivePhotoMeta, 'photoUrl'>; compare?: true };
export type CompareHeader = { kind: 'compare'; role: 'before' | 'after'; size: number; mime: string; sha256: string };
export function parseHeader(value: unknown): PhotoHeader {
  const h = value as PhotoHeader;
  const meta = h?.meta;
  const id = (v: unknown) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
  if (!h || h.kind !== 'photo' || (h.compare !== undefined && h.compare !== true) || !Number.isInteger(h.size) || h.size <= 0 || h.size > MAX_IMAGE_BYTES || !['image/jpeg', 'image/png', 'image/webp'].includes(h.mime) || !/^[a-f0-9]{64}$/.test(h.sha256) || !meta || !id(meta.id) || !id(meta.frameId) || typeof meta.createdAt !== 'string' || meta.createdAt.length > 40 || ['backgroundId', 'poseId', 'compositionId'].some((key) => meta[key as keyof typeof meta] !== undefined && !id(meta[key as keyof typeof meta])) || (meta.propIds !== undefined && (!Array.isArray(meta.propIds) || meta.propIds.length > 3 || !meta.propIds.every(id)))) throw new Error('사진 전달 정보가 올바르지 않아요. 다시 받아 주세요.');
  return h;
}
export function parseCompareHeader(value: unknown): CompareHeader {
  const h = value as CompareHeader;
  if (!h || h.kind !== 'compare' || (h.role !== 'before' && h.role !== 'after') || !Number.isInteger(h.size) || h.size <= 0 || h.size > MAX_COMPARE_BYTES || !['image/jpeg', 'image/webp'].includes(h.mime) || !/^[a-f0-9]{64}$/.test(h.sha256)) throw new Error('비교 사진 정보가 올바르지 않아요.');
  return h;
}
export async function hashBytes(bytes: ArrayBuffer) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
type Part = { size: number; mime: string; sha256: string };
/** Collects ordered chunks and verifies the announced size and SHA-256 before returning the image. */
class PartAssembler<T extends Part> {
  private chunks: ArrayBuffer[] = [];
  private size = 0;
  constructor(public header: T) {}
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
export class PhotoAssembler extends PartAssembler<PhotoHeader> {
  constructor(header: PhotoHeader) { super(parseHeader(header)); }
}
export class CompareAssembler extends PartAssembler<CompareHeader> {
  constructor(header: CompareHeader) { super(parseCompareHeader(header)); }
}

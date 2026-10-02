import { Storage } from '@google-cloud/storage';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'project-1e3fbae0-3a3e-4723-ae1';
export const BUCKET_NAME = process.env.PHOTOBOOTH_STORAGE_BUCKET || 'ai-hancut-photos-699923719631';
export const STORAGE_BASE_URL = `https://storage.googleapis.com/${BUCKET_NAME}`;

let storageInstance: Storage | null = null;

function getStorage(): Storage {
  if (!storageInstance) {
    storageInstance = new Storage({ projectId: PROJECT_ID });
  }
  return storageInstance;
}

export type LivePhotoMeta = {
  id: string;
  frameId: string;
  createdAt: string;
  photoUrl: string;
  backgroundId?: string;
  poseId?: string;
  propIds?: string[];
  compositionId?: string;
};

export async function uploadLivePhoto(
  id: string,
  imageBuffer: Buffer,
  meta: Omit<LivePhotoMeta, 'id' | 'photoUrl' | 'createdAt'>
): Promise<{ photoUrl: string; metaUrl: string }> {
  const storage = getStorage();
  const bucket = storage.bucket(BUCKET_NAME);

  const photoFile = bucket.file(`photos/${id}/photo.jpg`);
  const metaFile = bucket.file(`photos/${id}/meta.json`);

  const photoUrl = `${STORAGE_BASE_URL}/photos/${id}/photo.jpg`;
  const metaUrl = `${STORAGE_BASE_URL}/photos/${id}/meta.json`;

  const metaData: LivePhotoMeta = {
    id,
    frameId: meta.frameId,
    createdAt: new Date().toISOString(),
    photoUrl,
    backgroundId: meta.backgroundId,
    poseId: meta.poseId,
    propIds: meta.propIds,
    compositionId: meta.compositionId,
  };

  await Promise.all([
    photoFile.save(imageBuffer, {
      contentType: 'image/jpeg',
      resumable: false,
      metadata: {
        cacheControl: 'public, max-age=31536000, immutable',
      },
    }),
    metaFile.save(JSON.stringify(metaData, null, 2), {
      contentType: 'application/json',
      resumable: false,
      metadata: {
        cacheControl: 'public, max-age=3600',
      },
    }),
  ]);

  return { photoUrl, metaUrl };
}

export async function getLivePhotoMeta(id: string): Promise<LivePhotoMeta | null> {
  const metaUrl = `${STORAGE_BASE_URL}/photos/${id}/meta.json`;
  try {
    const res = await fetch(metaUrl, { cache: 'no-store' });
    if (!res.ok) {
      // Fallback: check if photo exists directly
      const photoCheck = await fetch(`${STORAGE_BASE_URL}/photos/${id}/photo.jpg`, { method: 'HEAD' });
      if (photoCheck.ok) {
        return {
          id,
          frameId: 'festival',
          createdAt: new Date().toISOString(),
          photoUrl: `${STORAGE_BASE_URL}/photos/${id}/photo.jpg`,
        };
      }
      return null;
    }
    return (await res.json()) as LivePhotoMeta;
  } catch (error) {
    console.error('[getLivePhotoMeta] fetch failed:', error);
    return null;
  }
}


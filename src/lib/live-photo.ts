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

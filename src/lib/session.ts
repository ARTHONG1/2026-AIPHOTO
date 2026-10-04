// Photos and choices live ONLY in this tab's memory. Refresh/restart drops them.

export type Selection = { backgroundId: string | null; poseId: string | null; propIds: string[]; compositionId: string | null };

const PHOTO_KEY = 'ai-hancut:photo';
const SELECTION_KEY = 'ai-hancut:selection';
const LEGACY_KEY = 'magic-markup-session';

export const EMPTY_SELECTION: Selection = { backgroundId: null, poseId: null, propIds: [], compositionId: null };

const memory: { photo: string | null; selection: Selection | null; result: string | null } = {
  photo: null,
  selection: null,
  result: null,
};

const cleanups = new Set<() => void>();
export function registerSessionCleanup(fn: () => void) {
  cleanups.add(fn);
  return () => { cleanups.delete(fn); };
}
function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

export function clearSession() {
  memory.photo = null;
  memory.selection = null;
  memory.result = null;
  for (const cleanup of [...cleanups]) safe(cleanup);
  safe(() => {
    sessionStorage.removeItem(PHOTO_KEY);
    sessionStorage.removeItem(SELECTION_KEY);
    localStorage.removeItem(LEGACY_KEY);
  });
}

export function setPhoto(photo: string) {
  clearSession();
  memory.photo = photo;
}

export function getPhoto(): string | null {
  return memory.photo;
}

export function saveSelection(selection: Selection) {
  memory.selection = selection;
}

export function loadSelection(): Selection {
  if (!memory.selection) {
    memory.selection = EMPTY_SELECTION;
  }
  return memory.selection;
}

export function setResult(image: string | null) {
  memory.result = image;
}

export function getResult() {
  return memory.result;
}

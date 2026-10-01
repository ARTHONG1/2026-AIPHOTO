// Per-visitor session: kept in memory for speed, mirrored to sessionStorage so a
// refresh does not lose the photo. Everything is cleared when a visitor restarts.

export type Selection = { backgroundId: string | null; poseId: string | null; propIds: string[] };

const PHOTO_KEY = 'ai-hancut:photo';
const SELECTION_KEY = 'ai-hancut:selection';
const LEGACY_KEY = 'magic-markup-session';

export const EMPTY_SELECTION: Selection = { backgroundId: null, poseId: null, propIds: [] };

const memory: { photo: string | null; selection: Selection | null; result: string | null } = {
  photo: null,
  selection: null,
  result: null,
};

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
  safe(() => {
    sessionStorage.removeItem(PHOTO_KEY);
    sessionStorage.removeItem(SELECTION_KEY);
    localStorage.removeItem(LEGACY_KEY);
  });
}

export function setPhoto(photo: string) {
  clearSession();
  memory.photo = photo;
  safe(() => sessionStorage.setItem(PHOTO_KEY, photo));
}

export function getPhoto(): string | null {
  if (!memory.photo) memory.photo = safe(() => sessionStorage.getItem(PHOTO_KEY));
  return memory.photo;
}

export function saveSelection(selection: Selection) {
  memory.selection = selection;
  safe(() => sessionStorage.setItem(SELECTION_KEY, JSON.stringify(selection)));
}

export function loadSelection(): Selection {
  if (!memory.selection) {
    const raw = safe(() => sessionStorage.getItem(SELECTION_KEY));
    const parsed = raw ? safe(() => JSON.parse(raw) as Selection) : null;
    memory.selection = parsed && Array.isArray(parsed.propIds) ? parsed : EMPTY_SELECTION;
  }
  return memory.selection;
}

export function setResult(image: string | null) {
  memory.result = image;
}

export function getResult() {
  return memory.result;
}

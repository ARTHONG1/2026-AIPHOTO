
import { CanvasObject, Annotation, Highlight, Tool, BrushSize } from './types';

export interface AppState {
  isMounted: boolean;
  apiKeys: string[];
  baseImage: string | null;
  elementImages: (File | null)[];
  elementImageUrls: (string | null)[];
  elementNames: string[];
  canvasObjects: CanvasObject[];
  tool: Tool;
  color: string;
  brushSize: BrushSize;
  customPrompt: string;
  selectedAction: string | null;
  isLoading: boolean;
  isElementUploadOpen: boolean;
  editingAnnotation: Annotation | null;
  isApiKeyDialogOpen: boolean;
  isQrCodeDialogOpen: boolean;
  qrCodeDataUrl: string | null;
  isActionDialogOpen: boolean;
  isPromptDialogOpen: boolean;
}

export const initialState: AppState = {
  isMounted: false,
  apiKeys: [],
  baseImage: null,
  elementImages: [null, null, null],
  elementImageUrls: [null, null, null],
  elementNames: ['', '', ''],
  canvasObjects: [],
  tool: 'highlight',
  color: '#D35898',
  brushSize: 'medium',
  customPrompt: '',
  selectedAction: null,
  isLoading: false,
  isElementUploadOpen: false,
  editingAnnotation: null,
  isApiKeyDialogOpen: false,
  isQrCodeDialogOpen: false,
  qrCodeDataUrl: null,
  isActionDialogOpen: false,
  isPromptDialogOpen: false,
};


export type ActionPayloads = {
    SET_IS_MOUNTED: boolean;
    LOAD_STATE_FROM_HISTORY: Partial<AppState> | null;
    START_NEW_SESSION: { baseImage: string };
    SET_API_KEYS: string[];
    SET_BASE_IMAGE: string | null;
    SET_ELEMENT_IMAGES: (File | null)[];
    SET_ELEMENT_IMAGE_URLS: (string | null)[];
    SET_ELEMENT_NAMES: string[];
    SET_CANVAS_OBJECTS: CanvasObject[];
    ADD_CANVAS_OBJECT: CanvasObject;
    UPDATE_LAST_HIGHLIGHT_POINT: { x: number; y: number };
    SAVE_ANNOTATION: { id: string; text: string; position?: { x: number; y: number }; color: string };
    SET_TOOL: Tool;
    SET_COLOR: string;
    SET_BRUSH_SIZE: BrushSize;
    SET_CUSTOM_PROMPT: string;
    SET_SELECTED_ACTION: string | null;
    SET_IS_LOADING: boolean;
    SET_IS_ELEMENT_UPLOAD_OPEN: boolean;
    SET_EDITING_ANNOTATION: Annotation | null;
    SET_IS_API_KEY_DIALOG_OPEN: boolean;
    SET_IS_QR_CODE_DIALOG_OPEN: boolean;
    SET_QR_CODE_DATA_URL: string | null;
    SET_IS_ACTION_DIALOG_OPEN: boolean;
    SET_IS_PROMPT_DIALOG_OPEN: boolean;
};

export type Action = { [K in keyof ActionPayloads]: { type: K; payload: ActionPayloads[K] } }[keyof ActionPayloads];

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_IS_MOUNTED':
      return { ...state, isMounted: action.payload };
    case 'LOAD_STATE_FROM_HISTORY':
        if (action.payload === null) {
            return {
                ...initialState,
                isMounted: true,
                apiKeys: state.apiKeys,
            }
        }
        return {
            ...state,
            ...action.payload,
        };
    case 'START_NEW_SESSION':
        return {
            ...state,
            baseImage: action.payload.baseImage,
            canvasObjects: [],
            customPrompt: '',
            selectedAction: null,
        };
    case 'SET_API_KEYS':
      return { ...state, apiKeys: action.payload };
    case 'SET_BASE_IMAGE':
      return { ...state, baseImage: action.payload };
    case 'SET_ELEMENT_IMAGES':
      return { ...state, elementImages: action.payload };
    case 'SET_ELEMENT_IMAGE_URLS':
      return { ...state, elementImageUrls: action.payload };
    case 'SET_ELEMENT_NAMES':
      return { ...state, elementNames: action.payload };
    case 'SET_CANVAS_OBJECTS':
      return { ...state, canvasObjects: action.payload };
    case 'ADD_CANVAS_OBJECT':
      return { ...state, canvasObjects: [...state.canvasObjects, action.payload] };
    case 'UPDATE_LAST_HIGHLIGHT_POINT': {
      const lastObject = state.canvasObjects[state.canvasObjects.length - 1];
      if (lastObject && lastObject.type === 'highlight') {
        const updatedHighlight = {
          ...lastObject,
          points: [...(lastObject as Highlight).points, action.payload],
        };
        return {
          ...state,
          canvasObjects: [...state.canvasObjects.slice(0, -1), updatedHighlight],
        };
      }
      return state;
    }
    case 'SAVE_ANNOTATION': {
        const { id, text, position, color } = action.payload;
        const existing = state.canvasObjects.find(obj => obj.id === id);
        if (existing) {
            return {
                ...state,
                canvasObjects: state.canvasObjects.map(obj => 
                    obj.id === id ? { ...obj, text, position: position || (obj as Annotation).position } : obj
                )
            }
        } else {
            const newAnnotation: Annotation = {
                id,
                type: 'annotation',
                text,
                position: position!,
                color,
                fontSize: 40 // Consider making this dynamic
            };
            return { ...state, canvasObjects: [...state.canvasObjects, newAnnotation] };
        }
    }
    case 'SET_TOOL':
      return { ...state, tool: action.payload };
    case 'SET_COLOR':
      return { ...state, color: action.payload };
    case 'SET_BRUSH_SIZE':
      return { ...state, brushSize: action.payload };
    case 'SET_CUSTOM_PROMPT':
      return { ...state, customPrompt: action.payload };
    case 'SET_SELECTED_ACTION':
      return { ...state, selectedAction: action.payload };
    case 'SET_IS_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_IS_ELEMENT_UPLOAD_OPEN':
      return { ...state, isElementUploadOpen: action.payload };
    case 'SET_EDITING_ANNOTATION':
      return { ...state, editingAnnotation: action.payload };
    case 'SET_IS_API_KEY_DIALOG_OPEN':
      return { ...state, isApiKeyDialogOpen: action.payload };
    case 'SET_IS_QR_CODE_DIALOG_OPEN':
      return { ...state, isQrCodeDialogOpen: action.payload };
    case 'SET_QR_CODE_DATA_URL':
      return { ...state, qrCodeDataUrl: action.payload };
    case 'SET_IS_ACTION_DIALOG_OPEN':
        return { ...state, isActionDialogOpen: action.payload };
    case 'SET_IS_PROMPT_DIALOG_OPEN':
        return { ...state, isPromptDialogOpen: action.payload };
    default:
      return state;
  }
}

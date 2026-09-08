
'use client';

import { useRef, useCallback, ChangeEvent, useEffect, useReducer } from 'react';
import { useToast } from '@/hooks/use-toast';
import { type Tool, type BrushSize, type CanvasObject, type Annotation, type Highlight } from '@/lib/types';
import { resizeImage } from '@/lib/canvas-utils';
import { generateImageAction, uploadImageToCloudinaryAction } from '@/app/actions';
import { reducer, initialState, Action, ActionPayloads } from '@/lib/state';
import { useSearchParams, useRouter } from 'next/navigation';

const EDITOR_COLORS = ['#D35898', '#3B82F6', '#22C55E', '#EAB308'] as const;
const BRUSH_SIZES: Record<BrushSize, number> = {
  small: 5,
  medium: 10,
  large: 20,
};
const MAX_DIMENSION = 1000;
const LOCAL_STORAGE_KEY_SESSION = 'magic-markup-session';

export function useMagicMarkup() {
  const { toast } = useToast();
  const [state, dispatch] = useReducer(reducer, initialState);
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    isMounted,
    baseImage,
    elementImageUrls,
    canvasObjects,
    tool,
    color,
    brushSize,
    customPrompt,
    selectedAction,
    selectedBackground,
    isLoading,
    editingAnnotation,
    isQrCodeDialogOpen,
    qrCodeDataUrl,
    isActionDialogOpen,
    isPromptDialogOpen,
    isBackgroundDialogOpen,
    guidedFlowStep,
    isCompletionDialogOpen,
    generatedImageUrl,
  } = state;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const interactionState = useRef<{
    isDrawing?: boolean;
    lastPosition?: { x: number, y: number };
  }>({});

  const history = useRef<any[]>([]);
  const historyPointer = useRef(-1);

  const dispatchAction = <T extends keyof ActionPayloads>(type: T, payload: ActionPayloads[T]) => {
      dispatch({ type, payload } as Action);
  }

  const setTool = (tool: Tool) => dispatchAction('SET_TOOL', tool);
  const setColor = (color: string) => dispatchAction('SET_COLOR', color);
  const setBrushSize = (brushSize: BrushSize) => dispatchAction('SET_BRUSH_SIZE', brushSize);
  const setCustomPrompt = (prompt: string) => dispatchAction('SET_CUSTOM_PROMPT', prompt);
  const setSelectedAction = (action: string | null) => dispatchAction('SET_SELECTED_ACTION', action);
  const setSelectedBackground = (background: string | null) => dispatchAction('SET_SELECTED_BACKGROUND', background);
  const setIsElementUploadOpen = (isOpen: boolean) => dispatchAction('SET_IS_ELEMENT_UPLOAD_OPEN', isOpen);
  const setEditingAnnotation = (annotation: Annotation | null) => dispatchAction('SET_EDITING_ANNOTATION', annotation);
  const setIsQrCodeDialogOpen = (isOpen: boolean) => dispatchAction('SET_IS_QR_CODE_DIALOG_OPEN', isOpen);
  const setQrCodeDataUrl = (url: string | null) => dispatchAction('SET_QR_CODE_DATA_URL', url);
  const setIsActionDialogOpen = (isOpen: boolean) => dispatchAction('SET_IS_ACTION_DIALOG_OPEN', isOpen);
  const setIsPromptDialogOpen = (isOpen: boolean) => dispatchAction('SET_IS_PROMPT_DIALOG_OPEN', isOpen);
  const setIsBackgroundDialogOpen = (isOpen: boolean) => dispatchAction('SET_IS_BACKGROUND_DIALOG_OPEN', isOpen);
  const setGuidedFlowStep = (step: 'background' | 'action' | 'prompt' | 'done' | null) => dispatchAction('SET_GUIDED_FLOW_STEP', step);
  const setIsCompletionDialogOpen = (isOpen: boolean) => dispatchAction('SET_IS_COMPLETION_DIALOG_OPEN', isOpen);
  const setGeneratedImageUrl = (url: string | null) => dispatchAction('SET_GENERATED_IMAGE_URL', url);

  const startNewSession = useCallback((newBaseImage: string) => {
    dispatchAction('START_NEW_SESSION', { baseImage: newBaseImage });
  }, []);

  const handleElementImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const reader = new FileReader();
      const url = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const resizedUrl = await resizeImage(url, MAX_DIMENSION, MAX_DIMENSION);
      
      const newUrls = [...elementImageUrls];
      const emptyIndex = newUrls.findIndex(u => u === null);
      if (emptyIndex !== -1) {
        newUrls[emptyIndex] = resizedUrl;
        dispatchAction('SET_ELEMENT_IMAGE_URLS', newUrls);
        setIsElementUploadOpen(false);
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Upload failed' });
    }
  };

  const undo = useCallback(() => {
    if (historyPointer.current > 0) {
      historyPointer.current--;
      dispatchAction('SET_CANVAS_OBJECTS', history.current[historyPointer.current]);
    }
  }, []);

  const redo = useCallback(() => {
    if (historyPointer.current < history.current.length - 1) {
      historyPointer.current++;
      dispatchAction('SET_CANVAS_OBJECTS', history.current[historyPointer.current]);
    }
  }, []);

  const handleClear = () => {
    dispatchAction('SET_CANVAS_OBJECTS', []);
    history.current = [[]];
    historyPointer.current = 0;
  };

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvasObjects.forEach(obj => {
      if (editingAnnotation?.id === obj.id) return;
      if (obj.type === 'highlight') {
        const h = obj as Highlight;
        ctx.strokeStyle = h.color;
        ctx.lineWidth = h.strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        h.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.stroke();
      }
    });
  }, [canvasObjects, editingAnnotation]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    interactionState.current.isDrawing = true;
    if (tool === 'highlight') {
      const newHighlight: Highlight = { 
        id: Date.now().toString(), 
        type: 'highlight',
        color, 
        points: [{ x, y }], 
        strokeWidth: BRUSH_SIZES[brushSize] * (canvas.width / MAX_DIMENSION) 
      };
      dispatchAction('ADD_CANVAS_OBJECT', newHighlight);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactionState.current.isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    if (tool === 'highlight') {
      dispatchAction('UPDATE_LAST_HIGHLIGHT_POINT', { x, y });
    }
  };

  const handleCanvasMouseUp = () => {
    if (interactionState.current.isDrawing) {
      if (historyPointer.current < history.current.length - 1) history.current.splice(historyPointer.current + 1);
      history.current.push(JSON.parse(JSON.stringify(canvasObjects)));
      historyPointer.current++;
    }
    interactionState.current.isDrawing = false;
  };

  const handleGenerate = useCallback(async () => {
    if (!baseImage) return;
    dispatchAction('SET_IS_LOADING', true);
    console.log('--- [Client] handleGenerate Start ---');
    try {
      const elementImagePayloads = (await Promise.all(elementImageUrls.map(async (url, i) => {
        if (!url) return null;
        return { name: `element${i+1}`, url, contentType: 'image/png' };
      }))).filter(el => el) as any[];

      const result = await generateImageAction({
        baseImage,
        elementImages: elementImagePayloads,
        customPrompt,
        actionPrompt: selectedAction ? `Pose: ${selectedAction}` : undefined,
        backgroundPrompt: selectedBackground ? `Background: ${selectedBackground}` : undefined,
      });

      if (result.editedImage) {
        setGeneratedImageUrl(result.editedImage);
        setIsCompletionDialogOpen(true);
      }
    } catch (error: any) {
      console.error('--- [Client] Generation Critical Error ---', error);
      toast({ 
        variant: 'destructive', 
        title: '생성 실패', 
        description: error.message || '이미지 생성 중 오류가 발생했습니다.' 
      });
    } finally {
      dispatchAction('SET_IS_LOADING', false);
    }
  }, [baseImage, elementImageUrls, customPrompt, selectedAction, selectedBackground, toast]);

  const handleDownload = useCallback(() => {
    const url = generatedImageUrl || baseImage;
    if (!url || url === "") return;
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ai-cut.png';
    link.click();
  }, [baseImage, generatedImageUrl]);

  const handleExportWithQrCode = async () => {
    if (!baseImage) return;
    setIsQrCodeDialogOpen(true);
    const url = await uploadImageToCloudinaryAction(baseImage);
    if (url) setQrCodeDataUrl(url);
  };

  const handleRestart = useCallback(() => {
    localStorage.removeItem(LOCAL_STORAGE_KEY_SESSION);
    router.push('/');
  }, [router]);

  useEffect(() => {
    dispatchAction('SET_IS_MOUNTED', true);
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_SESSION);
    if (saved) {
      const data = JSON.parse(saved);
      dispatchAction('LOAD_STATE_FROM_HISTORY', data);
      if (searchParams.get('isGuided') === 'true') {
        setTimeout(() => setGuidedFlowStep('background'), 500);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isMounted || !baseImage) return;
    localStorage.setItem(LOCAL_STORAGE_KEY_SESSION, JSON.stringify({
      baseImage,
      canvasObjects,
      elementImageUrls,
      customPrompt,
      selectedAction,
      selectedBackground,
    }));
  }, [isMounted, baseImage, canvasObjects, elementImageUrls, customPrompt, selectedAction, selectedBackground]);

  useEffect(() => {
    redrawCanvas();
  }, [canvasObjects, redrawCanvas]);

  useEffect(() => {
    if (guidedFlowStep === 'background' && selectedBackground) setGuidedFlowStep('action');
    if (guidedFlowStep === 'action' && selectedAction) setGuidedFlowStep('prompt');
    if (guidedFlowStep === 'prompt' && customPrompt && customPrompt !== "") setGuidedFlowStep('done');
    if (guidedFlowStep === 'done') {
      handleGenerate();
      setGuidedFlowStep(null);
    }
  }, [guidedFlowStep, selectedBackground, selectedAction, customPrompt, handleGenerate]);

  return {
    ...state,
    canvasRef,
    setTool,
    setColor,
    setBrushSize,
    setCustomPrompt,
    setSelectedAction,
    setSelectedBackground,
    setIsElementUploadOpen,
    setEditingAnnotation,
    setIsQrCodeDialogOpen,
    setIsActionDialogOpen,
    setIsPromptDialogOpen,
    setIsBackgroundDialogOpen,
    setGuidedFlowStep,
    setIsCompletionDialogOpen,
    startNewSession,
    handleElementImageUpload,
    undo,
    redo,
    handleClear,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleGenerate,
    handleExportWithQrCode,
    handleDownload,
    handleRestart,
    EDITOR_COLORS,
    handleSaveAnnotation: () => {},
  };
}

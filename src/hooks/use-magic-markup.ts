

'use client';

import { useRef, useCallback, ChangeEvent, useEffect, useReducer } from 'react';
import { useToast } from '@/hooks/use-toast';
import { type Tool, type BrushSize, type CanvasObject, type Annotation, type Highlight } from '@/lib/types';
import { resizeImage } from '@/lib/canvas-utils';
import { generateImageAction, uploadImageToCloudinaryAction } from '@/app/actions';
import { reducer, initialState, Action, ActionPayloads } from '@/lib/state';
import { BACKGROUNDS, ACTIONS, PREDEFINED_PROMPTS } from '@/components/toolbar';


const EDITOR_COLORS = ['#D35898', '#3B82F6', '#22C55E', '#EAB308'] as const;
const BRUSH_SIZES: Record<BrushSize, number> = {
  small: 5,
  medium: 10,
  large: 20,
};
const MAX_DIMENSION = 1000;
const SELECTION_PADDING = 10;
const LOCAL_STORAGE_KEY_SESSION = 'magic-markup-session';
const LOCAL_STORAGE_KEY_API_KEY = 'magic-markup-api-key';
const ANNOTATION_FONT_SIZE_MEDIUM = BRUSH_SIZES['medium'] * 4;

export function useMagicMarkup() {
  const { toast } = useToast();
  const [state, dispatch] = useReducer(reducer, initialState);

  const {
    isMounted,
    apiKeys,
    baseImage,
    elementImages,
    elementImageUrls,
    elementNames,
    canvasObjects,
    tool,
    color,
    brushSize,
    customPrompt,
    selectedAction,
    selectedBackground,
    isLoading,
    isElementUploadOpen,
    editingAnnotation,
    isApiKeyDialogOpen,
    isQrCodeDialogOpen,
    qrCodeDataUrl,
    isActionDialogOpen,
    isPromptDialogOpen,
    isBackgroundDialogOpen,
  } = state;


  // Canvas interaction refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const interactionState = useRef<{
    isDrawing?: boolean;
    isDragging?: boolean;
    dragOffset?: { x: number, y: number };
    lastPosition?: { x: number, y: number };
    lastClickTime?: number;
  }>({});

  const history = useRef<any[]>([]);
  const historyPointer = useRef(-1);

  const elementFileInputRef = useRef<HTMLInputElement>(null);
  
  // -- ACTION DISPATCHERS --
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
  const setIsApiKeyDialogOpen = (isOpen: boolean) => dispatchAction('SET_IS_API_KEY_DIALOG_OPEN', isOpen);
  const setElementImages = (images: (File | null)[]) => dispatchAction('SET_ELEMENT_IMAGES', images);
  const setElementImageUrls = (urls: (string | null)[]) => dispatchAction('SET_ELEMENT_IMAGE_URLS', urls);
  const setElementNames = (names: string[]) => dispatchAction('SET_ELEMENT_NAMES', names);
  const setIsQrCodeDialogOpen = (isOpen: boolean) => dispatchAction('SET_IS_QR_CODE_DIALOG_OPEN', isOpen);
  const setQrCodeDataUrl = (url: string | null) => dispatchAction('SET_QR_CODE_DATA_URL', url);
  const setIsActionDialogOpen = (isOpen: boolean) => dispatchAction('SET_IS_ACTION_DIALOG_OPEN', isOpen);
  const setIsPromptDialogOpen = (isOpen: boolean) => dispatchAction('SET_IS_PROMPT_DIALOG_OPEN', isOpen);
  const setIsBackgroundDialogOpen = (isOpen: boolean) => dispatchAction('SET_IS_BACKGROUND_DIALOG_OPEN', isOpen);
  
  const setApiKeys = (keys: string[]) => {
    dispatchAction('SET_API_KEYS', keys);
    localStorage.setItem(LOCAL_STORAGE_KEY_API_KEY, JSON.stringify(keys));
  }

  // -- SESSION & HISTORY MANAGEMENT --
  
  const startNewSession = useCallback((newBaseImage: string) => {
    dispatchAction('START_NEW_SESSION', { baseImage: newBaseImage });
  }, []);
  
  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleElementImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await addElementImage(file);
  };
  
  const addElementImage = useCallback(async (file: File) => {
    const emptyIndex = elementImageUrls.findIndex(el => el === null);
    if (emptyIndex === -1) {
      toast({ variant: 'destructive', title: 'Cannot add more elements', description: 'You can only add up to 3 elements.' });
      return;
    }
    
    try {
      const url = await readFileAsDataURL(file);
      const resizedUrl = await resizeImage(url, MAX_DIMENSION, MAX_DIMENSION);

      const newImages = [...elementImages];
      newImages[emptyIndex] = file;
      setElementImages(newImages);

      const newUrls = [...elementImageUrls];
      newUrls[emptyIndex] = resizedUrl;
      setElementImageUrls(newUrls);
      setIsElementUploadOpen(false);
      toast({ title: `Element ${emptyIndex + 1} added.` });
    } catch (error) {
       toast({
        variant: 'destructive',
        title: 'Error reading file',
        description: 'Could not read the selected image file.',
      });
    }
  }, [elementImageUrls, elementImages, toast]);

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    return { x, y };
  };
  
  const saveHistory = useCallback(() => {
    if (historyPointer.current < history.current.length - 1) {
      history.current.splice(historyPointer.current + 1);
    }
    history.current.push(JSON.parse(JSON.stringify(canvasObjects)));
    historyPointer.current++;
  }, [canvasObjects]);

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

    const drawObject = (obj: CanvasObject) => {
        if (editingAnnotation && editingAnnotation.id === obj.id) return;

        if (obj.type === 'highlight') {
            const h = obj as Highlight;
            ctx.strokeStyle = h.color;
            ctx.lineWidth = h.strokeWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            h.points.forEach((p, i) => {
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();

            if (h.selected) {
                ctx.strokeStyle = '#007AFF';
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.2;
                ctx.stroke();
            }

        } else if (obj.type === 'annotation') {
            const a = obj as Annotation;
            ctx.globalAlpha = 1.0;
            ctx.font = `bold ${a.fontSize}px "Patrick Hand", cursive`;
            ctx.fillStyle = a.color;
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = a.fontSize / 15;
            ctx.strokeText(a.text, a.position.x, a.position.y);
            ctx.fillText(a.text, a.position.x, a.position.y);

            if(!a.width || !a.height) {
              const metrics = ctx.measureText(a.text);
              a.width = metrics.width;
              a.height = a.fontSize;
            }

            if (a.selected) {
                ctx.strokeStyle = '#007AFF';
                ctx.lineWidth = 2;
                ctx.globalAlpha = 1.0;
                ctx.strokeRect(
                    a.position.x - SELECTION_PADDING,
                    a.position.y - a.height - SELECTION_PADDING,
                    a.width + SELECTION_PADDING * 2,
                    a.height + SELECTION_PADDING * 2
                );
            }
        }
    };

    canvasObjects.forEach(drawObject);

  }, [canvasObjects, editingAnnotation]);
  
  const hitTest = (x: number, y: number): CanvasObject | null => {
      for (let i = canvasObjects.length - 1; i >= 0; i--) {
          const obj = canvasObjects[i];
          if (obj.type === 'annotation') {
              const a = obj as Annotation;
              if(a.width && a.height) {
                if (x >= a.position.x && x <= a.position.x + a.width && y >= a.position.y - a.height && y <= a.position.y) {
                    return obj;
                }
              }
          } else if (obj.type === 'highlight') {
              const h = obj as Highlight;
              const isNear = h.points.some(p => Math.hypot(p.x - x, p.y - y) < h.strokeWidth / 2 + 5);
              if (isNear) return obj;
          }
      }
      return null;
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoordinates(e);

    if (tool === 'annotate') {
      setEditingAnnotation({
        id: Date.now().toString(),
        type: 'annotation',
        text: '',
        color: color,
        position: {x, y},
        fontSize: ANNOTATION_FONT_SIZE_MEDIUM * ((canvasRef.current?.width || MAX_DIMENSION) / MAX_DIMENSION)
      });
      return;
    }

    if (tool === 'select') {
        const now = Date.now();
        const doubleClick = (now - (interactionState.current.lastClickTime || 0)) < 300;
        interactionState.current.lastClickTime = now;
        
        const hitObject = hitTest(x, y);

        if (doubleClick && hitObject?.type === 'annotation') {
          setEditingAnnotation(hitObject as Annotation);
          dispatchAction('SET_CANVAS_OBJECTS', canvasObjects.map(obj => obj.id === hitObject.id ? obj : { ...obj, selected: false }));
          return;
        }
        
        dispatchAction('SET_CANVAS_OBJECTS', canvasObjects.map(obj => {
          const isSelected = obj.id === hitObject?.id;
          if (obj.selected !== isSelected) {
              return { ...obj, selected: isSelected };
          }
          return obj;
        }));

        if (hitObject && hitObject.type === 'annotation') {
            interactionState.current = { 
              ...interactionState.current,
              isDragging: true, 
              dragOffset: { x: x - (hitObject as Annotation).position.x, y: y - (hitObject as Annotation).position.y }
            };
        }
        return;
    }
    
    interactionState.current = { isDrawing: true, lastPosition: { x, y } };

    if (tool === 'highlight') {
        const newHighlight: Highlight = { 
          id: Date.now().toString(), 
          type: 'highlight',
          color, 
          points: [{ x, y }], 
          strokeWidth: BRUSH_SIZES[brushSize] * (canvasRef.current!.width / MAX_DIMENSION) 
        };
        dispatchAction('ADD_CANVAS_OBJECT', newHighlight);
    } else if (tool === 'erase') {
        erase(x, y);
    }
  };

  const handleSaveAnnotation = (text: string, id: string, newPosition?: {x: number, y: number}) => {
    if (text) {
      dispatchAction('SAVE_ANNOTATION', { id, text, position: newPosition, color });
      saveHistory();
    }
    setEditingAnnotation(null);
  };
  
  const erase = (x: number, y: number) => {
    const hitObject = hitTest(x, y);
    if(hitObject) {
      dispatchAction('SET_CANVAS_OBJECTS', canvasObjects.filter(obj => obj.id !== hitObject.id));
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { isDrawing, isDragging } = interactionState.current;
    if (!isDrawing && !isDragging) return;

    const { x, y } = getCanvasCoordinates(e);

    if (isDragging && tool === 'select') {
      const { dragOffset } = interactionState.current;
      dispatchAction('SET_CANVAS_OBJECTS', canvasObjects.map(obj => {
          if (obj.selected && obj.type === 'annotation' && dragOffset) {
              return { ...obj, position: { x: x - dragOffset.x, y: y - dragOffset.y } };
          }
          return obj;
      }));
      return;
    }

    if (tool === 'highlight' && isDrawing) {
        dispatchAction('UPDATE_LAST_HIGHLIGHT_POINT', {x,y});
    } else if (tool === 'erase' && isDrawing) {
        erase(x, y);
    }
  };

  const handleCanvasMouseUp = () => {
    const { isDrawing, isDragging } = interactionState.current;
    if (isDrawing || isDragging) {
      saveHistory();
    }
    interactionState.current.isDrawing = false;
    interactionState.current.isDragging = false;
  };

  const toDataUrl = (url: string, callback: (dataUrl: string) => void) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function() {
          const reader = new FileReader();
          reader.onloadend = function() {
              callback(reader.result as string);
          }
          reader.readAsDataURL(xhr.response);
      };
      xhr.open('GET', url);
      xhr.responseType = 'blob';
      xhr.send();
  }

  const toPayload = (url: string) => {
    const match = url.match(/^data:(image\/[a-z]+);base64,/);
    return {
      url,
      contentType: match ? match[1] : 'image/png',
    };
  };

  const handleGenerate = async () => {
    if (!apiKeys || apiKeys.length === 0) {
      setIsApiKeyDialogOpen(true);
      return;
    }

    if (!baseImage) {
      toast({
        variant: 'destructive',
        title: 'No Base Image',
        description: 'Please upload a base image to edit.',
      });
      return;
    }
    
    const highlights = canvasObjects.filter(o => o.type === 'highlight') as Highlight[];
    const annotations = canvasObjects.filter(o => o.type === 'annotation') as Annotation[];
    const hasElements = elementImageUrls.some(url => url !== null);
    
    const predefinedPrompt = PREDEFINED_PROMPTS.find(p => p.name === customPrompt);
    const isFaceSwap = !!predefinedPrompt?.swap;

    if (highlights.length === 0 && annotations.length === 0 && !customPrompt && !hasElements && !selectedAction && !selectedBackground) {
      toast({
        variant: 'destructive',
        title: 'Nothing to Generate',
        description: 'Please add highlights, annotations, a prompt, a background, an element image, or select an action.',
      });
      return;
    }

    dispatchAction('SET_IS_LOADING', true);

    try {
      let annotatedImage: string | undefined = undefined;
      
      if (highlights.length > 0 || annotations.length > 0) {
        const annotatedCanvas = document.createElement('canvas');
        const baseImg = new window.Image();
        baseImg.src = baseImage;
        await new Promise(resolve => { baseImg.onload = resolve; });

        annotatedCanvas.width = baseImg.naturalWidth;
        annotatedCanvas.height = baseImg.naturalHeight;
        const ctx = annotatedCanvas.getContext('2d');
        if(!ctx) throw new Error("Could not get canvas context");
        
        ctx.drawImage(baseImg, 0, 0);

        highlights.forEach(h => {
            ctx.strokeStyle = h.color;
            ctx.lineWidth = h.strokeWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            h.points.forEach((p: {x: number, y: number}, i: number) => {
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();
        });

        ctx.globalAlpha = 1.0;
        annotations.forEach(a => {
            ctx.font = `bold ${a.fontSize}px "Patrick Hand", cursive`;
            ctx.fillStyle = a.color;
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = a.fontSize / 15;
            ctx.strokeText(a.text, a.position.x, a.position.y);
            ctx.fillText(a.text, a.position.x, a.position.y);
        });
        
        const fullSizeAnnotatedImage = annotatedCanvas.toDataURL('image/png');
        annotatedImage = await resizeImage(fullSizeAnnotatedImage, MAX_DIMENSION, MAX_DIMENSION);
      }

      const elementImagePayloads = (await Promise.all(elementImageUrls.map(async (url, i) => {
        if (!url) return null;
        return {
          name: elementNames[i] || `element${i+1}`,
          ...toPayload(url)
        };
      }))).filter(el => el) as { name: string; url: string; contentType: string }[];
      
      
      if (predefinedPrompt && predefinedPrompt.imageUrl) {
        const dataUrl = await new Promise<string>(resolve => toDataUrl(predefinedPrompt.imageUrl, resolve));
        elementImagePayloads.push({
          name: 'prompt-image',
          ...toPayload(dataUrl)
        });
      }

      let requestBaseImage = baseImage;
      // Handle face swap
      if (isFaceSwap) {
          const promptImageElement = elementImagePayloads.find(e => e.name === 'prompt-image');
          if (promptImageElement) {
              // The prompt image becomes the base image
              requestBaseImage = promptImageElement.url;
              // The original base image is passed as an element so we can get the face
              elementImagePayloads.push({
                  name: 'Original Image',
                  ...toPayload(baseImage)
              });
          }
      }
      
      let actionPrompt: string | undefined;
      if (selectedAction) {
        if (selectedAction === '만세') {
            actionPrompt = "Change the pose of the subject to be raising both hands up high. Make it look realistic and natural.";
        } else if (selectedAction === '하트') {
            actionPrompt = "Change the pose of the subject to be making a heart shape with both hands over their chest. Make it look realistic and natural.";
        } else if (selectedAction === '찰칵') {
            actionPrompt = "Change the pose of the subject to the 'photo frame' pose, where they form a rectangular frame with their thumbs and index fingers. The right hand should form an 'L' shape, and the left hand should form a reversed 'L' shape. The tips of the index fingers should nearly touch to form the top of the frame, and the thumbs should form the bottom. The frame should be positioned to be nearly adjacent to the subject's face, appearing to surround their eyes. The final pose should look like a natural, iconic picture-taking gesture.";
        } else {
            actionPrompt = `Change the pose of the subject to be doing a '${selectedAction}' pose. Make it look realistic and natural.`;
        }
      }
      
      let backgroundPrompt: string | undefined;
      const selectedBackgroundObject = BACKGROUNDS.find(b => b.name === selectedBackground);
      let backgroundImageUrl;
      if (selectedBackgroundObject) {
        backgroundImageUrl = await new Promise<string>(resolve => toDataUrl(selectedBackgroundObject.imageUrl, resolve));
        backgroundPrompt = `Change the background of the image to be '${selectedBackground}'. Make it look realistic and natural, and blend the subject into the new background.`;
      }


      let result;
      let success = false;
      for (let i = 0; i < apiKeys.length; i++) {
        const currentKey = apiKeys[i];
        try {
            result = await generateImageAction({
                apiKey: currentKey,
                baseImage: requestBaseImage,
                annotatedImage,
                elementImages: elementImagePayloads,
                customPrompt,
                actionPrompt,
                backgroundPrompt,
                backgroundImageUrl: backgroundImageUrl ? toPayload(backgroundImageUrl) : undefined,
              });
            
            if (result.editedImage) {
                const resizedUrl = await resizeImage(result.editedImage, MAX_DIMENSION, MAX_DIMENSION);
                
                // On success, move the successful key to the front of the list
                const newApiKeys = [...apiKeys];
                const successfulKey = newApiKeys.splice(i, 1)[0];
                newApiKeys.unshift(successfulKey);
                setApiKeys(newApiKeys);
                
                startNewSession(resizedUrl);
                success = true;
                break;
            }
        } catch (error: any) {
            console.warn(`API key ${i+1} failed:`, error.message);
            if (i === apiKeys.length - 1) {
                // Last key failed
                throw error;
            }
        }
      }

      if (!success) {
        throw new Error('All API keys failed or the AI model did not return an image.');
      }

    } catch (error: any) {
      console.error('AI Generation Error:', error);
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: error.message || 'The AI could not process the image. Please try again.',
      });
    } finally {
      dispatchAction('SET_IS_LOADING', false);
    }
  };
  
  const handleExportWithQrCode = async () => {
    if (!baseImage) return;

    setIsQrCodeDialogOpen(true);
    setQrCodeDataUrl(null);

    try {
      const cloudinaryUrl = await uploadImageToCloudinaryAction(baseImage);
      if (cloudinaryUrl) {
        setQrCodeDataUrl(cloudinaryUrl);
      } else {
        throw new Error("Failed to get URL from Cloudinary.");
      }
    } catch (error) {
      console.error("Failed to process image for QR Code", error);
      toast({
        variant: 'destructive',
        title: 'QR Code Error',
        description: 'Could not generate QR code for the image.',
      });
      setIsQrCodeDialogOpen(false);
    }
  };
  
  const handleRemoveElementImage = (index: number) => {
    const newImages = [...elementImages];
    newImages.splice(index, 1);
    newImages.push(null);
    setElementImages(newImages);

    const newUrls = [...elementImageUrls];
    newUrls.splice(index, 1);
    newUrls.push(null);
    setElementImageUrls(newUrls);
    
    const newNames = [...elementNames];
    newNames.splice(index, 1);
    newNames.push('');
    setElementNames(newNames);
  };

  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
    }

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') === -1) continue;

      const file = items[i].getAsFile();
      if (!file) continue;

      if (isElementUploadOpen) {
        await addElementImage(file);
      }
      break;
    }
  }, [isElementUploadOpen, addElementImage]);
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || editingAnnotation) {
        return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      const hasSelection = canvasObjects.some(o => o.selected);
      if (hasSelection) {
        e.preventDefault();
        dispatchAction('SET_CANVAS_OBJECTS', canvasObjects.filter(o => !o.selected));
        saveHistory();
      }
    }
  }, [canvasObjects, saveHistory, editingAnnotation]);

  const handlePromptKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleSaveApiKey = (key: string) => {
    if(apiKeys.includes(key)) {
        toast({ variant: 'destructive', title: "Key already exists"});
        return;
    }
    const newKeys = [key, ...apiKeys];
    setApiKeys(newKeys);
    toast({ title: "API Key saved!"});
  }

  const handleDeleteApiKey = (index: number) => {
    const newKeys = [...apiKeys];
    newKeys.splice(index, 1);
    setApiKeys(newKeys);
    toast({ title: "API Key deleted!"});
  }

  useEffect(() => {
    dispatchAction('SET_IS_MOUNTED', true);
    try {
      const savedKeysRaw = localStorage.getItem(LOCAL_STORAGE_KEY_API_KEY);
      if (savedKeysRaw) {
        try {
            const savedKeys = JSON.parse(savedKeysRaw);
            if(Array.isArray(savedKeys)) {
                dispatchAction('SET_API_KEYS', savedKeys);
            }
        } catch (e) {
            // If parsing fails, it's likely a raw string key from a previous version
            if (typeof savedKeysRaw === 'string') {
                dispatchAction('SET_API_KEYS', [savedKeysRaw]);
            }
        }
      }

      const savedSession = localStorage.getItem(LOCAL_STORAGE_KEY_SESSION);
      if (savedSession) {
        const sessionData = JSON.parse(savedSession);
        dispatchAction('LOAD_STATE_FROM_HISTORY', sessionData);
      }
    } catch (e) {
      console.error("Failed to load session from local storage", e);
      localStorage.removeItem(LOCAL_STORAGE_KEY_SESSION);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isMounted || !baseImage) return;
    try {
      const dataToSave = JSON.stringify({
        baseImage,
        annotations: canvasObjects,
        elementImageUrls,
        elementNames,
        prompt: customPrompt,
        selectedAction,
        selectedBackground,
      });
      localStorage.setItem(LOCAL_STORAGE_KEY_SESSION, dataToSave);
    } catch(e) {
      console.error("Failed to save session to local storage", e);
    }
  }, [isMounted, baseImage, canvasObjects, elementImageUrls, elementNames, customPrompt, selectedAction, selectedBackground]);


  useEffect(() => {
    history.current.push([]);
    historyPointer.current = 0;

    window.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
        window.removeEventListener('paste', handlePaste);
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlePaste, handleKeyDown]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !baseImage) return;
    const img = new window.Image();
    img.src = baseImage;
    img.onload = () => {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        redrawCanvas();
        saveHistory();
    }
  }, [baseImage, redrawCanvas, saveHistory]);

  useEffect(() => {
    redrawCanvas();
  }, [canvasObjects, redrawCanvas]);

  return {
    // State
    isMounted,
    apiKeys,
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
    isElementUploadOpen,
    editingAnnotation,
    isApiKeyDialogOpen,
    elementImages,
    elementNames,
    isQrCodeDialogOpen,
    qrCodeDataUrl,
    isActionDialogOpen,
    isPromptDialogOpen,
    isBackgroundDialogOpen,

    // Refs
    canvasRef,
    elementFileInputRef,

    // State Setters (dispatchers)
    setTool,
    setColor,
    setBrushSize,
    setCustomPrompt,
    setSelectedAction,
    setSelectedBackground,
    setIsElementUploadOpen,
    setEditingAnnotation,
    setIsApiKeyDialogOpen,
    setElementImages,
    setElementImageUrls,
    setElementNames,
    setIsQrCodeDialogOpen,
    setIsActionDialogOpen,
    setIsPromptDialogOpen,
    setIsBackgroundDialogOpen,

    // Functions
    startNewSession,
    handleElementImageUpload,
    undo,
    redo,
    handleClear,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleSaveAnnotation,
    handleGenerate,
    handleExportWithQrCode,
    handleRemoveElementImage,
    handlePromptKeyDown,
    handleSaveApiKey,
    handleDeleteApiKey,

    // Constants
    EDITOR_COLORS,
  };
}

    
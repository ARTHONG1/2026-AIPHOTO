

'use client';

import Image from 'next/image';
import {
  MousePointer2,
  Brush,
  ClipboardCopy,
  Download,
  Eraser,
  Loader2,
  Palette,
  Redo2,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  UploadCloud,
  X,
  Plus,
  Paintbrush,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ColorPicker } from './color-picker';
import { IconButton } from './icon-button';
import { BrushSize, Tool } from '@/lib/types';
import { useMagicMarkup } from '@/hooks/use-magic-markup';
import { cn } from '@/lib/utils';

type ToolbarProps = ReturnType<typeof useMagicMarkup>;

export const PREDEFINED_PROMPTS = [
  { name: 'Add a pair of futuristic AI engineering glasses on the person’s face. \nThe glasses should look realistic and seamlessly integrated, \nwith a metallic frame, glowing neon blue highlights, \nand transparent smart lenses displaying subtle holographic data. \nEnsure the glasses fit naturally on the face with proper lighting and shadows.', imageUrl: '/안경.png' },
  { name: 'Change the clothing of the person in the photo to this T-shirt. Make it look natural and realistic, including folds, shadows, and lighting, as if they were originally wearing it.', imageUrl: '/티셔츠.png' },
];

export const ACTIONS = [
    { name: '만세', imageUrl: '/만세.png' },
    { name: '하트', imageUrl: '/하트.png' },
    { name: '던지기', imageUrl: '/던지기.jpg' },
]

export const BACKGROUNDS: { name: string; imageUrl: string }[] = [
    { name: '우주', imageUrl: 'https://res.cloudinary.com/dckjyturf/image/upload/v1757657254/Gemini_Generated_Image_qkmdwrqkmdwrqkmd_gm1yuj.png' },
    { name: '실험실', imageUrl: 'https://res.cloudinary.com/dckjyturf/image/upload/v1757664005/1757663981648_ipeebp.png' },
    { name: '고고학', imageUrl: 'https://res.cloudinary.com/dckjyturf/image/upload/v1757665006/1757664992151_kzartg.png' },
];


export function Toolbar({
  tool,
  setTool,
  undo,
  redo,
  handleClear,
  color,
  setColor,
  brushSize,
  setBrushSize,
  isElementUploadOpen,
  setIsElementUploadOpen,
  elementImageUrls,
  elementFileInputRef,
  handleElementImageUpload,
  handleRemoveElementImage,
  customPrompt,
  setCustomPrompt,
  selectedAction,
  setSelectedAction,
  selectedBackground,
  setSelectedBackground,
  handlePromptKeyDown,
  handleGenerate,
  isLoading,
  baseImage,
  isActionDialogOpen,
  setIsActionDialogOpen,
  isPromptDialogOpen,
  setIsPromptDialogOpen,
  isBackgroundDialogOpen,
  setIsBackgroundDialogOpen,
  EDITOR_COLORS,
}: ToolbarProps) {
  const selectedPromptImage = PREDEFINED_PROMPTS.find(p => p.name === customPrompt)?.imageUrl;
  const selectedActionImage = ACTIONS.find(a => a.name === selectedAction)?.imageUrl;
  const selectedBackgroundImage = BACKGROUNDS.find(b => b.name === selectedBackground)?.imageUrl;
  
  return (
    <aside className="flex flex-col gap-4 border-l bg-card p-4">
      <div className="flex items-center justify-end gap-1">
        <IconButton icon={Undo2} tooltip="실행 취소" onClick={undo} />
        <IconButton icon={Redo2} tooltip="다시 실행" onClick={redo} />
        <IconButton icon={Trash2} tooltip="모두 지우기" onClick={handleClear} />
      </div>

      {/*
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">요소</CardTitle>
          <Dialog open={isElementUploadOpen} onOpenChange={setIsElementUploadOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" disabled={elementImageUrls.every(url => url !== null)}>
                <Plus className="size-5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>요소 이미지 추가</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center justify-center gap-4 py-8">
                <Button onClick={() => elementFileInputRef.current?.click()} className="w-full">
                  <UploadCloud className="mr-2" />
                  컴퓨터에서 업로드
                </Button>
                <p className="text-sm text-muted-foreground">또는 이미지 붙여넣기 (Cmd+V)</p>
                <input type="file" accept="image/*" className="hidden" ref={elementFileInputRef} onChange={handleElementImageUpload} />
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {elementImageUrls.some(url => url !== null) ? (
            <div className="grid grid-cols-3 gap-2">
              {elementImageUrls.map((url, i) =>
                url ? (
                  <div key={i} className="relative aspect-square w-full">
                    <img src={url} alt={`Element ${i + 1}`} className="rounded-md w-full h-full object-cover" />
                    <Button variant="destructive" size="icon" className="absolute -right-2 -top-2 size-6 rounded-full" onClick={() => handleRemoveElementImage(i)}>
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <div key={i} />
                )
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">아직 추가된 요소가 없습니다.</p>
          )}
        </CardContent>
      </Card>
      */}
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">배경</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {selectedBackground ? (
             <div className="flex items-center justify-between">
             {selectedBackgroundImage ? (
                <div className="relative w-20 aspect-square">
                   <img src={selectedBackgroundImage} alt={selectedBackground} className="w-full h-full object-cover rounded-md" />
                </div>
             ) : (
               <span className="font-semibold">{selectedBackground}</span>
             )}
              <Button variant="ghost" size="sm" onClick={() => setSelectedBackground(null)}>
                <X className="mr-2 size-4" />
                선택 해제
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">선택된 배경 없음</p>
          )}
           <Dialog open={isBackgroundDialogOpen} onOpenChange={setIsBackgroundDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">배경 선택</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>배경 선택</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
                {BACKGROUNDS.map((background) => (
                    <DialogClose asChild key={background.name}>
                        <button
                          onClick={() => setSelectedBackground(background.name)}
                          className={cn("relative group aspect-square w-full overflow-hidden rounded-lg border-2",
                            selectedBackground === background.name ? "border-primary" : "border-transparent"
                          )}
                        >
                            <img src={background.imageUrl} alt={background.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                        </button>
                    </DialogClose>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">동작</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {selectedAction ? (
             <div className="flex items-center justify-between">
             {selectedActionImage ? (
                <div className="relative w-20 aspect-square">
                   <img src={selectedActionImage} alt={selectedAction} className="w-full h-full object-cover rounded-md" />
                </div>
             ) : (
               <span className="font-semibold">{selectedAction}</span>
             )}
              <Button variant="ghost" size="sm" onClick={() => setSelectedAction(null)}>
                <X className="mr-2 size-4" />
                선택 해제
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">선택된 동작 없음</p>
          )}
           <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">동작 선택</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>동작 선택</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
                {ACTIONS.map((action) => (
                    <DialogClose asChild key={action.name}>
                        <button
                          onClick={() => setSelectedAction(action.name)}
                          className={cn("relative group aspect-square w-full overflow-hidden rounded-lg border-2",
                            selectedAction === action.name ? "border-primary" : "border-transparent"
                          )}
                        >
                            <img src={action.imageUrl} alt={action.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                        </button>
                    </DialogClose>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <CardTitle className="text-lg">프롬프트</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {customPrompt ? (
            <div className="flex items-center justify-between">
              {selectedPromptImage ? (
                 <div className="relative w-20 aspect-square">
                    <img src={selectedPromptImage} alt={customPrompt} className="w-full h-full object-cover rounded-md" />
                 </div>
              ) : (
                <span className="font-semibold">{customPrompt}</span>
              )}
               <Button variant="ghost" size="sm" onClick={() => setCustomPrompt('')}>
                <X className="mr-2 size-4" />
                선택 해제
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">선택된 프롬프트 없음</p>
          )}

          <Dialog open={isPromptDialogOpen} onOpenChange={setIsPromptDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">프롬프트 선택</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>프롬프트 선택</DialogTitle>
              </DialogHeader>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
                {PREDEFINED_PROMPTS.map(prompt => (
                    <DialogClose asChild key={prompt.name}>
                        <button
                            onClick={() => setCustomPrompt(prompt.name)}
                            className={cn("relative group aspect-square w-full overflow-hidden rounded-lg border-2",
                            customPrompt === prompt.name ? "border-primary" : "border-transparent"
                            )}
                        >
                            <img src={prompt.imageUrl} alt={prompt.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                        </button>
                    </DialogClose>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Button size="lg" onClick={handleGenerate} disabled={isLoading || !baseImage}>
        {isLoading ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Sparkles className="mr-2 size-5" />}
        이미지 생성
      </Button>
    </aside>
  );
}

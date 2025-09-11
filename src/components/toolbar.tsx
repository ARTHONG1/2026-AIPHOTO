
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

const PREDEFINED_PROMPTS = [
  '얼굴에 아이언맨 가면을 씌워줘',
  '과학자 안경을 만들어줘',
  // Add more prompts here
];

const ACTIONS = [
    { name: '만세', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/nanobanana-real-photo-booth.firebasestorage.app/o/%EB%A7%8C%EC%84%B8%20%EB%AA%A8%EC%85%98.png?alt=media&token=c89734ff-5db9-4392-ac9c-8770064d7eb4' },
    { name: '하트', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/nanobanana-real-photo-booth.firebasestorage.app/o/%ED%95%98%ED%8A%B8%20%EB%AA%A8%EC%85%98.png?alt=media&token=9635f1be-22b6-4908-9635-430c8003f954' },
]

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
  handlePromptKeyDown,
  handleGenerate,
  isLoading,
  baseImage,
  isActionDialogOpen,
  setIsActionDialogOpen,
  EDITOR_COLORS,
}: ToolbarProps) {
  return (
    <aside className="flex flex-col gap-4 border-l bg-card p-4">
      <div className="flex items-center justify-end gap-1">
        <IconButton icon={Undo2} tooltip="실행 취소" onClick={undo} />
        <IconButton icon={Redo2} tooltip="다시 실행" onClick={redo} />
        <IconButton icon={Trash2} tooltip="모두 지우기" onClick={handleClear} />
      </div>

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
                    <Image src={url} alt={`Element ${i + 1}`} layout="fill" objectFit="cover" className="rounded-md" />
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
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">동작</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {selectedAction ? (
            <div className="flex items-center justify-between">
              <span className="font-semibold">{selectedAction}</span>
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>동작 선택</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                {ACTIONS.map((action) => (
                    <DialogClose asChild key={action.name}>
                        <button
                          onClick={() => setSelectedAction(action.name)}
                          className={cn("relative aspect-square w-full overflow-hidden rounded-lg border-2",
                            selectedAction === action.name ? "border-primary" : "border-transparent"
                          )}
                        >
                            <Image src={action.imageUrl} alt={action.name} layout="fill" objectFit="cover" />
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
        <CardContent className="flex-1 flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">적용할 프롬프트를 선택하세요:</p>
            {PREDEFINED_PROMPTS.map(prompt => (
                <Button
                    key={prompt}
                    variant={customPrompt === prompt ? 'secondary' : 'outline'}
                    onClick={() => setCustomPrompt(prompt)}
                    className="justify-start"
                >
                    {customPrompt === prompt && <Check className="mr-2 size-4" />}
                    {prompt}
                </Button>
            ))}
            {customPrompt && (
              <Button variant="ghost" size="sm" onClick={() => setCustomPrompt('')} className="text-muted-foreground">
                <X className="mr-2" />
                선택 해제
              </Button>
            )}
        </CardContent>
      </Card>

      <Button size="lg" onClick={handleGenerate} disabled={isLoading || !baseImage}>
        {isLoading ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Sparkles className="mr-2 size-5" />}
        이미지 생성
      </Button>
    </aside>
  );
}

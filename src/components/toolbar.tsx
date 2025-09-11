
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
    '만세',
    '하트',
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
  EDITOR_COLORS,
}: ToolbarProps) {
  return (
    <aside className="flex flex-col gap-4 border-l bg-card p-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">도구</CardTitle>
          <div className="flex items-center gap-1">
            <IconButton icon={Undo2} tooltip="실행 취소" onClick={undo} />
            <IconButton icon={Redo2} tooltip="다시 실행" onClick={redo} />
            <IconButton icon={Trash2} tooltip="모두 지우기" onClick={handleClear} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center gap-1">
            <IconButton icon={MousePointer2} tooltip="선택" isActive={tool === 'select'} onClick={() => setTool('select')} />
            <IconButton icon={Brush} tooltip="강조" isActive={tool === 'highlight'} onClick={() => setTool('highlight')} />
            <IconButton icon={Type} tooltip="텍스트" isActive={tool === 'annotate'} onClick={() => setTool('annotate')} />
            <IconButton icon={Eraser} tooltip="지우기" isActive={tool === 'erase'} onClick={() => setTool('erase')} />
          </div>
          <Separator />
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <Palette className="size-5 text-muted-foreground" />
              <ColorPicker colors={EDITOR_COLORS} selectedColor={color} onColorChange={setColor} />
            </div>
            <div className="flex items-center gap-2">
              <Paintbrush className="size-5 text-muted-foreground" />
              <ToggleGroup type="single" value={brushSize} onValueChange={(value) => value && setBrushSize(value as BrushSize)}>
                <ToggleGroupItem value="small" aria-label="Small">
                  <div className="bg-foreground rounded-full size-2" />
                </ToggleGroupItem>
                <ToggleGroupItem value="medium" aria-label="Medium">
                  <div className="bg-foreground rounded-full size-3" />
                </ToggleGroupItem>
                <ToggleGroupItem value="large" aria-label="Large">
                  <div className="bg-foreground rounded-full size-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </CardContent>
      </Card>

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
            {ACTIONS.map(action => (
                <Button
                    key={action}
                    variant={selectedAction === action ? 'secondary' : 'outline'}
                    onClick={() => setSelectedAction(selectedAction === action ? null : action)}
                    className="justify-start"
                >
                    {selectedAction === action && <Check className="mr-2 size-4" />}
                    {action}
                </Button>
            ))}
             {selectedAction && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedAction(null)} className="text-muted-foreground">
                <X className="mr-2" />
                선택 해제
              </Button>
            )}
             {ACTIONS.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">아직 추가된 동작이 없습니다.</p>}
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

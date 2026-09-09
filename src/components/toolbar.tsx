
'use client';

import Image from 'next/image';
import {
  Undo2,
  Redo2,
  Trash2,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { IconButton } from './icon-button';
import { useMagicMarkup } from '@/hooks/use-magic-markup';
import { cn } from '@/lib/utils';
import { useRef, useEffect } from 'react';
import { ScrollArea } from './ui/scroll-area';

import { PREDEFINED_PROMPTS, ACTIONS, BACKGROUNDS } from '@/lib/image-presets';
export { PREDEFINED_PROMPTS, ACTIONS, BACKGROUNDS } from '@/lib/image-presets';

export function Toolbar({
  undo,
  redo,
  handleClear,
  customPrompt,
  setCustomPrompt,
  selectedAction,
  setSelectedAction,
  selectedBackground,
  setSelectedBackground,
  handleGenerate,
  isLoading,
  baseImage,
  isActionDialogOpen,
  setIsActionDialogOpen,
  isPromptDialogOpen,
  setIsPromptDialogOpen,
  isBackgroundDialogOpen,
  setIsBackgroundDialogOpen,
  guidedFlowStep,
}: ReturnType<typeof useMagicMarkup>) {
  const selectedPromptImage = PREDEFINED_PROMPTS.find(p => p.name === customPrompt)?.imageUrl;
  const selectedActionImage = ACTIONS.find(a => a.name === selectedAction)?.imageUrl;
  const selectedBackgroundItem = BACKGROUNDS.find(b => b.name === selectedBackground);

  const backgroundTriggerRef = useRef<HTMLButtonElement>(null);
  const actionTriggerRef = useRef<HTMLButtonElement>(null);
  const promptTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (guidedFlowStep === 'background' && backgroundTriggerRef.current) {
      backgroundTriggerRef.current.click();
    } else if (guidedFlowStep === 'action' && actionTriggerRef.current) {
      actionTriggerRef.current.click();
    } else if (guidedFlowStep === 'prompt' && promptTriggerRef.current) {
      promptTriggerRef.current.click();
    }
  }, [guidedFlowStep]);
  
  return (
    <aside className="flex flex-col gap-4 border-l bg-card p-4">
      <div className="flex items-center justify-end gap-1">
        <IconButton icon={Undo2} tooltip="실행 취소" onClick={undo} />
        <IconButton icon={Redo2} tooltip="다시 실행" onClick={redo} />
        <IconButton icon={Trash2} tooltip="모두 지우기" onClick={handleClear} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">배경</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {selectedBackground && selectedBackgroundItem ? (
             <div className="flex items-center justify-between">
               <div className="relative size-20 rounded-md overflow-hidden border">
                  <Image src={selectedBackgroundItem.imageUrl} alt={selectedBackground} fill className="object-cover" sizes="80px" />
               </div>
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
              <Button variant="outline" ref={backgroundTriggerRef}>배경 선택</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>배경 선택</DialogTitle>
                <DialogDescription>나만의 사진에 어울리는 배경을 골라보세요.</DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-[70vh]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-4 pr-4">
                  {BACKGROUNDS.map((background) => (
                      <DialogClose asChild key={background.name}>
                          <button
                            onClick={() => setSelectedBackground(background.name)}
                            className={cn("relative group aspect-square w-full overflow-hidden rounded-lg border-2",
                              selectedBackground === background.name ? "border-primary" : "border-transparent"
                            )}
                          >
                              <Image src={background.imageUrl} alt={background.name} fill className="object-cover" sizes="300px" />
                          </button>
                      </DialogClose>
                  ))}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">동작</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {selectedAction && selectedActionImage ? (
             <div className="flex items-center justify-between">
                <div className="relative size-20 rounded-md overflow-hidden border">
                   <Image src={selectedActionImage} alt={selectedAction} fill className="object-cover" sizes="80px" />
                </div>
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
              <Button variant="outline" ref={actionTriggerRef}>동작 선택</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>동작 선택</DialogTitle>
                <DialogDescription>어떤 포즈를 취하고 싶나요?</DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-[70vh]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-4 pr-4">
                  {ACTIONS.map((action) => (
                      <DialogClose asChild key={action.name}>
                          <button
                            onClick={() => setSelectedAction(action.name)}
                            className={cn("relative group aspect-square w-full overflow-hidden rounded-lg border-2",
                              selectedAction === action.name ? "border-primary" : "border-transparent"
                            )}
                          >
                              <Image src={action.imageUrl} alt={action.name} fill className="object-cover" sizes="300px" />
                          </button>
                      </DialogClose>
                  ))}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <CardTitle className="text-lg">프롬프트</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {customPrompt && selectedPromptImage ? (
            <div className="flex items-center justify-between">
              <div className="relative size-20 rounded-md overflow-hidden border">
                 <Image src={selectedPromptImage} alt={customPrompt} fill className="object-contain" sizes="80px" />
              </div>
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
              <Button variant="outline" ref={promptTriggerRef}>프롬프트 선택</Button>
            </DialogTrigger>
            <DialogContent className="max-w-7xl">
              <DialogHeader>
                <DialogTitle>프롬프트 선택</DialogTitle>
                <DialogDescription>AI에게 어떤 변화를 줄지 선택하세요.</DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-[70vh]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-4 pr-4">
                  {PREDEFINED_PROMPTS.map(prompt => (
                      <DialogClose asChild key={prompt.name}>
                          <button
                              onClick={() => setCustomPrompt(prompt.name)}
                              className={cn("relative group aspect-video w-full overflow-hidden rounded-lg border-2",
                              customPrompt === prompt.name ? "border-primary" : "border-transparent"
                              )}
                          >
                              <Image src={prompt.imageUrl} alt={prompt.name} fill className="object-contain" sizes="300px" />
                          </button>
                      </DialogClose>
                  ))}
                </div>
              </ScrollArea>
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

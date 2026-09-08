'use client';

import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Progress } from './ui/progress';

interface CompletionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  onRestart: () => void;
  onDownload: () => void;
}

export function CompletionDialog({
  isOpen,
  onOpenChange,
  imageUrl,
  onRestart,
  onDownload,
}: CompletionDialogProps) {
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen) {
      setCountdown(30);
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen]);

  // 카운트다운 완료 시 재시작 로직을 별도의 useEffect로 분리하여 렌더링 중 상태 변경을 방지합니다.
  useEffect(() => {
    if (isOpen && countdown === 0) {
      onRestart();
    }
  }, [countdown, isOpen, onRestart]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">완성!</DialogTitle>
          <DialogDescription className="text-center">멋진 AI 사진이 완성되었습니다. 다운로드하거나 다시 시작해보세요.</DialogDescription>
        </DialogHeader>
        <div className="my-4 relative aspect-[2/3] w-full">
          {imageUrl && (
            <Image
              src={imageUrl}
              alt="Generated image"
              fill
              className="object-contain rounded-lg"
              sizes="(max-width: 1024px) 100vw, 1024px"
            />
          )}
        </div>
        <DialogFooter className="sm:justify-center gap-2">
           <Button type="button" size="lg" variant="secondary" onClick={onDownload}>
            <Download className="mr-2 h-4 w-4"/>
            다운로드
          </Button>
          <Button type="button" size="lg" onClick={onRestart}>
            다시 시작
          </Button>
        </DialogFooter>
        <div className="flex flex-col gap-2 items-center">
            <Progress value={(countdown / 30) * 100} className="w-full h-2" />
            <p className="text-sm text-muted-foreground">{countdown}초 후에 자동으로 다시 시작합니다.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}


'use client';

import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Progress } from './ui/progress';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      setCountdown(30);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            onRestart();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isOpen, onRestart]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">완성!</DialogTitle>
        </DialogHeader>
        <div className="my-4">
          {imageUrl && (
            <Image
              src={imageUrl}
              alt="Generated image"
              width={1024}
              height={1536}
              className="w-full h-auto object-contain rounded-lg"
            />
          )}
        </div>
        <DialogFooter className="sm:justify-center gap-2">
           <Button type="button" size="lg" variant="secondary" onClick={onDownload}>
            <Download className="mr-2"/>
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

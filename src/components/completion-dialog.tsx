
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

interface CompletionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  onRestart: () => void;
}

export function CompletionDialog({
  isOpen,
  onOpenChange,
  imageUrl,
  onRestart,
}: CompletionDialogProps) {
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
          <Button type="button" size="lg" onClick={onRestart}>
            다시 시작
          </Button>
           <Button type="button" size="lg" variant="secondary" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

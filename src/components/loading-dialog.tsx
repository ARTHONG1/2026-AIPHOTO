
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface LoadingDialogProps {
  isOpen: boolean;
}

export function LoadingDialog({ isOpen }: LoadingDialogProps) {
  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md flex flex-col items-center justify-center gap-6 p-8" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">AI 이미지 생성 중</DialogTitle>
          <DialogDescription className="text-center">
            Vertex AI가 멋진 이미지를 만들고 있습니다. 잠시만 기다려 주세요...
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground animate-pulse">마법이 일어나는 중...</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

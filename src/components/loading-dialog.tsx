
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
        </DialogHeader>
        <div className="relative w-full h-24 overflow-hidden">
          <div className="dino-container">
            <div className="dino"></div>
          </div>
        </div>
        <p className="text-muted-foreground">잠시만 기다려 주세요...</p>
        <style jsx>{`
          .dino-container {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 100px; 
          }
          .dino {
            width: 80px;
            height: 84px;
            background-image: url('/dino.png');
            background-size: 752px 84px;
            animation: walk 1s steps(9) infinite, forward 5s linear infinite;
            position: absolute;
            bottom: 0;
          }
          @keyframes walk {
            from { background-position-x: 0px; }
            to { background-position-x: -676px; }
          }
          @keyframes forward {
            from { transform: translateX(-100px); }
            to { transform: translateX(110%); }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}

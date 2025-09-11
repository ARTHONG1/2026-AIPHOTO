
'use client';

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface QrCodeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  dataUrl: string | null;
}

export function QrCodeDialog({ isOpen, onOpenChange, dataUrl }: QrCodeDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen && dataUrl && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, dataUrl, {
        width: 256,
        margin: 2,
        errorCorrectionLevel: 'L',
      }, (error) => {
        if (error) console.error('QR Code generation failed:', error);
      });
    }
  }, [isOpen, dataUrl]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR코드로 내보내기</DialogTitle>
          <DialogDescription>
            스마트폰 카메라로 QR 코드를 스캔하여 이미지를 기기로 바로 다운로드하세요.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center p-4">
          {dataUrl ? (
            <canvas ref={canvasRef} />
          ) : (
            <p className="text-muted-foreground">QR 코드를 생성하는 중입니다...</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

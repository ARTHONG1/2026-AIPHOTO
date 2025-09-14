
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface CopyrightDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CopyrightDialog({ isOpen, onOpenChange }: CopyrightDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>오픈소스 라이선스</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-muted-foreground py-4">
          <p>
            이 앱에는 아파치 라이선스 2.0이 적용된 Magic Markup 프로젝트의 코드가 포함되어 있습니다.
          </p>
          <p>
            원본 저작권: Copyright 2024 Michael Bleigh
            <br />
            2차 창작물 저작권: Copyright 인천봉수초 교사 홍찬우
          </p>
          <p>
            모든 코드는 Apache License, Version 2.0에 따라 사용됩니다.
          </p>
          <p>
            라이선스 전문은 아래와 같습니다.
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              닫기
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound } from 'lucide-react';

interface ApiKeyDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (apiKey: string) => void;
  existingApiKey: string | null;
}

export function ApiKeyDialog({ isOpen, onOpenChange, onSave, existingApiKey }: ApiKeyDialogProps) {
  const [newApiKey, setNewApiKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNewApiKey('');
    }
  }, [isOpen]);

  const handleSave = () => {
    if (newApiKey.trim()) {
      onSave(newApiKey.trim());
    }
  };

  const getMaskedKey = () => {
    if (!existingApiKey) return '없음';
    return `••••••••••••${existingApiKey.slice(-4)}`;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound /> API 키 관리
          </DialogTitle>
          <DialogDescription>
            이미지를 생성하려면 Google AI API 키를 입력하세요. 키는{' '}
            <Link href="https://ai.studio/apikey" target="_blank" className="underline">
              Google AI Studio
            </Link>
            에서 발급받을 수 있으며, 브라우저의 로컬 저장소에 안전하게 저장됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="existing-api-key" className="text-right">
                    현재 키
                </Label>
                <Input
                    id="existing-api-key"
                    value={getMaskedKey()}
                    className="col-span-3 font-code"
                    disabled
                />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="api-key" className="text-right">
                    새 키
                </Label>
                <Input
                    id="api-key"
                    type="text"
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    placeholder="새 API 키를 입력하세요..."
                    className="col-span-3"
                />
            </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              취소
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={!newApiKey.trim()}>
            새 키 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


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
import { KeyRound, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface ApiKeyDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (apiKey: string) => void;
  onDelete: (index: number) => void;
  existingApiKeys: string[];
}

export function ApiKeyDialog({ isOpen, onOpenChange, onSave, onDelete, existingApiKeys }: ApiKeyDialogProps) {
  const [newApiKey, setNewApiKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNewApiKey('');
    }
  }, [isOpen]);

  const handleSave = () => {
    if (newApiKey.trim()) {
      onSave(newApiKey.trim());
      setNewApiKey('');
    }
  };

  const getMaskedKey = (key: string | null) => {
    if (!key) return '없음';
    if (key.length <= 4) return '••••••••••••';
    return `••••••••••••${key.slice(-4)}`;
  }
  
  const currentKey = existingApiKeys?.[0] || null;
  const fallbackKeys = existingApiKeys?.slice(1) || [];

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
                <Label htmlFor="current-api-key" className="text-right">
                    현재 키
                </Label>
                <Input
                    id="current-api-key"
                    value={getMaskedKey(currentKey)}
                    className="col-span-3 font-code"
                    disabled
                />
            </div>

            {fallbackKeys.length > 0 && (
                 <div className="col-span-4">
                    <Label>예비 키</Label>
                    <div className="grid gap-2 mt-2">
                        {fallbackKeys.map((key, index) => (
                            <div key={index} className="flex items-center justify-between gap-2">
                            <Input
                                value={getMaskedKey(key)}
                                className="font-code"
                                disabled
                            />
                            <Button variant="ghost" size="icon" onClick={() => onDelete(index + 1)}>
                                <Trash2 className="size-4" />
                            </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <Separator />
            
            <Label htmlFor="api-key">새 키 추가</Label>
            <div className="flex items-center gap-2">
                <Input
                    id="api-key"
                    type="text"
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    placeholder="새 API 키를 입력하세요..."
                    className="col-span-3"
                />
                 <Button type="button" onClick={handleSave} disabled={!newApiKey.trim()}>
                    추가
                </Button>
            </div>
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

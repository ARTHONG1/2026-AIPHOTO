
'use client';

import { QrCode, Home, Download } from 'lucide-react';
import Image from 'next/image';
import { Button } from './ui/button';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  onApiKeyClick?: () => void;
  onExportWithQrCodeClick: () => void;
  onDownloadClick: () => void;
  isExportDisabled: boolean;
}

export function Header({ onExportWithQrCodeClick, onDownloadClick, isExportDisabled }: HeaderProps) {
  const router = useRouter();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-2 w-1/3">
        <Image 
          src="/icon.png" 
          alt="AI한컷 Icon" 
          width={32} 
          height={32} 
          className="rounded-xl" 
          style={{ width: 'auto', height: 'auto' }}
        />
        <h1 className="font-headline text-xl font-semibold tracking-tight text-foreground">
          AI한컷
        </h1>
      </div>
      <div className="flex-1 text-center font-code text-xs text-muted-foreground"></div>
      <div className="flex justify-end w-1/3 gap-2">
        <Button variant="outline" size="sm" onClick={onDownloadClick} disabled={isExportDisabled}>
          <Download className="mr-2 h-4 w-4"/>
          다운로드
        </Button>
        <Button variant="default" size="sm" onClick={() => router.push('/')} className="bg-yellow-500 text-black hover:bg-yellow-600">
          <Home className="mr-2 h-4 w-4"/>
          처음으로
        </Button>
        <Button variant="outline" size="sm" onClick={onExportWithQrCodeClick} disabled={isExportDisabled}>
          <QrCode className="mr-2 h-4 w-4"/>
          QR코드
        </Button>
      </div>
    </header>
  );
}

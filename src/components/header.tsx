
import { KeyRound, Download } from 'lucide-react';
import { IconButton } from './icon-button';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from './ui/button';

interface HeaderProps {
  onApiKeyClick: () => void;
  onDownloadClick: () => void;
  isDownloadDisabled: boolean;
}

export function Header({ onApiKeyClick, onDownloadClick, isDownloadDisabled }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-2 w-1/3">
        <Image src="/icon.png" alt="Magic Markup Icon" width="32" height="32" className="rounded-xl" style={{ height: 'auto', width: 'auto' }}/>
        <h1 className="font-headline text-xl font-semibold tracking-tight text-foreground">
          과학네컷
        </h1>
      </div>
      <div className="flex-1 text-center font-code text-xs text-muted-foreground">
        <Link href="https://github.com/mbleigh/magic-markup" target="_blank" className="underline hover:text-foreground">open source</Link> by <Link href="https://mbleigh.dev/" target="_blank" className="underline hover:text-foreground">Michael Bleigh</Link> with <Link href="https://genkit.dev" target="_blank" className="underline hover:text-foreground">Genkit</Link> and Gemini 2.5 Flash
      </div>
      <div className="flex justify-end w-1/3 gap-2">
        <Button variant="outline" size="sm" onClick={onDownloadClick} disabled={isDownloadDisabled}>
            <Download className="mr-2"/>
            이미지 다운로드
        </Button>
        <IconButton icon={KeyRound} tooltip="API 키 변경" onClick={onApiKeyClick} />
      </div>
    </header>
  );
}

'use client';

import { Suspense } from 'react';
import { Camera } from 'lucide-react';
import { useMagicMarkup } from '@/hooks/use-magic-markup';
import { Button } from '@/components/ui/button';
import { Header } from './header';
import { EditorCanvas } from './editor-canvas';
import { Toolbar } from './toolbar';
import { QrCodeDialog } from './qr-code-dialog';
import { LoadingDialog } from './loading-dialog';
import { CompletionDialog } from './completion-dialog';
import { useRouter } from 'next/navigation';

function MagicMarkupEditorClient() {
  const hook = useMagicMarkup();
  const router = useRouter();

  if (!hook.isMounted) return null;

  return (
    <div className="flex h-screen flex-col">
      <Header
        onExportWithQrCodeClick={hook.handleExportWithQrCode}
        onDownloadClick={hook.handleDownload}
        isExportDisabled={!hook.baseImage}
      />
      <div className="grid flex-1 grid-cols-1 md:grid-cols-[1fr_350px]">
        <main className="flex flex-col items-center justify-center bg-background/50 p-4">
          {hook.baseImage ? (
            <EditorCanvas
              baseImage={hook.baseImage}
              canvasRef={hook.canvasRef}
              tool={hook.tool}
              handleCanvasMouseDown={hook.handleCanvasMouseDown}
              handleCanvasMouseMove={hook.handleCanvasMouseMove}
              handleCanvasMouseUp={hook.handleCanvasMouseUp}
              editingAnnotation={hook.editingAnnotation}
              handleSaveAnnotation={hook.handleSaveAnnotation}
              setEditingAnnotation={hook.setEditingAnnotation}
            />
          ) : (
            <div className="flex w-full h-full max-w-2xl max-h-[70vh] items-center justify-center rounded-2xl border-2 border-dashed border-border">
              <div className="text-center p-8 w-full max-w-lg">
                <Camera className="mx-auto size-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">이미지 없음</h3>
                <p className="mt-1 text-sm text-muted-foreground">포토부스에서 사진을 찍어 시작하세요.</p>
                <Button className="mt-4" onClick={() => router.push('/booth')}>
                  포토부스로 이동
                </Button>
              </div>
            </div>
          )}
        </main>
        
        <Toolbar {...hook} />

        <QrCodeDialog
          isOpen={hook.isQrCodeDialogOpen}
          onOpenChange={hook.setIsQrCodeDialogOpen}
          dataUrl={hook.qrCodeDataUrl}
        />
        
        <LoadingDialog isOpen={hook.isLoading} />

        <CompletionDialog
          isOpen={hook.isCompletionDialogOpen}
          onOpenChange={hook.setIsCompletionDialogOpen}
          imageUrl={hook.generatedImageUrl}
          onRestart={hook.handleRestart}
          onDownload={hook.handleDownload}
        />
      </div>
    </div>
  );
}

export function MagicMarkupEditor() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
      <MagicMarkupEditorClient />
    </Suspense>
  )
}

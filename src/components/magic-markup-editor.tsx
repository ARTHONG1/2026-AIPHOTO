
'use client';

import { Camera } from 'lucide-react';
import { useMagicMarkup } from '@/hooks/use-magic-markup';
import { Button } from '@/components/ui/button';
import { Header } from './header';
import { EditorCanvas } from './editor-canvas';
import { Toolbar } from './toolbar';
import { ApiKeyDialog } from './api-key-dialog';
import { useRouter } from 'next/navigation';

export function MagicMarkupEditor() {
  const hook = useMagicMarkup();
  const router = useRouter();

  if (!hook.isMounted) {
    return null; // or a loading spinner
  }

  return (
    <div className="flex h-screen flex-col">
      <Header
        onApiKeyClick={() => hook.setIsApiKeyDialogOpen(true)}
        onCopyClick={hook.handleCopyBaseImage}
        isCopyDisabled={!hook.baseImage}
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
                <h3 className="mt-4 text-lg font-medium">No Image</h3>
                <p className="mt-1 text-sm text-muted-foreground">Start by taking a photo in the photo booth.</p>
                <Button className="mt-4" onClick={() => router.push('/booth')}>
                  Go to Photo Booth
                </Button>
              </div>
            </div>
          )}
        </main>
        
        <Toolbar {...hook} />

        <ApiKeyDialog 
          isOpen={hook.isApiKeyDialogOpen}
          onOpenChange={hook.setIsApiKeyDialogOpen}
          onSave={hook.handleSaveApiKey}
          onDelete={hook.handleDeleteApiKey}
          existingApiKeys={hook.apiKeys}
        />

      </div>
    </div>
  );
}

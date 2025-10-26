import { MagicMarkupEditor } from '@/components/magic-markup-editor';
import { Suspense } from 'react';

export default function EditorPage() {
  return (
    <main className="min-h-screen bg-background">
      <Suspense fallback={<div>Loading...</div>}>
        <MagicMarkupEditor />
      </Suspense>
    </main>
  );
}

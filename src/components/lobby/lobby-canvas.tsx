'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { LobbySceneHandle } from './lobby-scene';
import { cn } from '@/lib/utils';

export type LobbyCanvasHandle = { warp: (durationMs?: number) => Promise<void> };

/** Mounts the three.js scene after first paint; three.js is code-split out of the main bundle. */
export const LobbyCanvas = forwardRef<LobbyCanvasHandle, { className?: string }>(function LobbyCanvas({ className }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<LobbySceneHandle | null>(null);
  const [ready, setReady] = useState(false);

  useImperativeHandle(ref, () => ({ warp: (ms) => sceneRef.current?.warp(ms) ?? Promise.resolve() }), []);

  useEffect(() => {
    let cancelled = false;
    import('./lobby-scene')
      .then(({ createLobbyScene }) => {
        if (cancelled || !hostRef.current) return;
        sceneRef.current = createLobbyScene(hostRef.current, { onReady: () => !cancelled && setReady(true) });
      })
      .catch((error) => console.warn('[lobby] scene failed to load', error));
    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={cn('pointer-events-none transition-opacity duration-1000', ready ? 'opacity-100' : 'opacity-0', className)}
    />
  );
});

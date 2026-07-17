import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser } from 'lucide-react';

export interface SignaturePadHandle {
  getDataUrl: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
}

interface Props {
  height?: number;
  onChange?: (hasSignature: boolean) => void;
}

/** Canvas de assinatura responsivo — preenche a largura do container e centraliza. */
export const SignaturePad = React.forwardRef<SignaturePadHandle, Props>(
  ({ height = 180, onChange }, ref) => {
    const wrapRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const hasDrawn = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);
    const [empty, setEmpty] = useState(true);

    // Configura o backing store do canvas conforme a largura real do container
    useEffect(() => {
      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      if (!wrap || !canvas) return;

      const setup = () => {
        const width = wrap.clientWidth;
        const ratio = window.devicePixelRatio || 1;
        // preserva o desenho existente
        const prev = hasDrawn.current ? canvas.toDataURL() : null;
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(ratio, ratio);
          ctx.lineWidth = 2.2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = '#111';
          if (prev) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0, width, height);
            img.src = prev;
          }
        }
      };

      setup();
      const ro = new ResizeObserver(setup);
      ro.observe(wrap);
      return () => ro.disconnect();
    }, [height]);

    function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
      const rect = canvasRef.current!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function handleDown(e: React.PointerEvent<HTMLCanvasElement>) {
      canvasRef.current?.setPointerCapture(e.pointerId);
      drawing.current = true;
      last.current = getPos(e);
    }

    function handleMove(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!drawing.current) return;
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx || !last.current) return;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      last.current = pos;
      if (!hasDrawn.current) {
        hasDrawn.current = true;
        setEmpty(false);
        onChange?.(true);
      }
    }

    function handleUp() {
      drawing.current = false;
      last.current = null;
    }

    function clear() {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasDrawn.current = false;
      setEmpty(true);
      onChange?.(false);
    }

    React.useImperativeHandle(ref, () => ({
      getDataUrl: () => (hasDrawn.current ? canvasRef.current?.toDataURL('image/png') || null : null),
      clear,
      isEmpty: () => !hasDrawn.current,
    }));

    return (
      <div className="space-y-2">
        <div ref={wrapRef} className="relative w-full border rounded-lg bg-white overflow-hidden" style={{ height }}>
          <canvas
            ref={canvasRef}
            onPointerDown={handleDown}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            onPointerLeave={handleUp}
            className="block cursor-crosshair touch-none"
          />
          {empty && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="text-sm text-muted-foreground/60">Assine aqui</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Use o mouse ou o dedo para assinar</span>
          <Button type="button" size="sm" variant="ghost" onClick={clear} disabled={empty}>
            <Eraser className="h-3.5 w-3.5 mr-1" /> Limpar
          </Button>
        </div>
      </div>
    );
  }
);
SignaturePad.displayName = 'SignaturePad';

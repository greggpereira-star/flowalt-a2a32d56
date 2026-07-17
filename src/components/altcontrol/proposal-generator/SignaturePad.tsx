import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser } from 'lucide-react';

export interface SignaturePadHandle {
  getDataUrl: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
}

interface Props {
  width?: number;
  height?: number;
  onChange?: (hasSignature: boolean) => void;
}

export const SignaturePad = React.forwardRef<SignaturePadHandle, Props>(
  ({ width = 480, height = 180, onChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const hasDrawn = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);
    const [empty, setEmpty] = useState(true);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#111';
    }, [width, height]);

    function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
      const rect = canvasRef.current!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function handleDown(e: React.PointerEvent<HTMLCanvasElement>) {
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
        <div className="border rounded-md bg-white inline-block touch-none">
          <canvas
            ref={canvasRef}
            onPointerDown={handleDown}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            onPointerLeave={handleUp}
            className="cursor-crosshair rounded-md"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Desenhe sua assinatura acima</span>
          <Button type="button" size="sm" variant="ghost" onClick={clear} disabled={empty}>
            <Eraser className="h-3.5 w-3.5 mr-1" /> Limpar
          </Button>
        </div>
      </div>
    );
  }
);
SignaturePad.displayName = 'SignaturePad';

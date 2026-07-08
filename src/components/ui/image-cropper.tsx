import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, convertToPixelCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, RotateCcw, Check, X } from 'lucide-react';

interface ImageCropperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  aspectRatio?: number;
  minSize?: number;
  suggestedSize?: { width: number; height: number };
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

async function getCroppedImg(
  image: HTMLImageElement,
  crop: PixelCrop,
  quality = 0.9
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  // Set canvas size to the cropped area
  canvas.width = crop.width * scaleX;
  canvas.height = crop.height * scaleY;

  // Enable high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw the cropped image
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );

  // If the image is too large, resize it
  const maxSize = 800;
  if (canvas.width > maxSize || canvas.height > maxSize) {
    const resizeCanvas = document.createElement('canvas');
    const resizeCtx = resizeCanvas.getContext('2d');
    
    if (!resizeCtx) throw new Error('No resize context');

    const scale = Math.min(maxSize / canvas.width, maxSize / canvas.height);
    resizeCanvas.width = canvas.width * scale;
    resizeCanvas.height = canvas.height * scale;

    resizeCtx.imageSmoothingEnabled = true;
    resizeCtx.imageSmoothingQuality = 'high';
    resizeCtx.drawImage(canvas, 0, 0, resizeCanvas.width, resizeCanvas.height);

    return new Promise((resolve, reject) => {
      resizeCanvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Canvas to Blob failed'))),
        'image/jpeg',
        quality
      );
    });
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas to Blob failed'))),
      'image/jpeg',
      quality
    );
  });
}

export const ImageCropper: React.FC<ImageCropperProps> = ({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete,
  aspectRatio = 1,
  minSize = 100,
  suggestedSize = { width: 400, height: 400 }
}) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [scale, setScale] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const initialCrop = centerAspectCrop(width, height, aspectRatio);
    setCrop(initialCrop);
    setCompletedCrop(convertToPixelCrop(initialCrop, width, height));
  }, [aspectRatio]);

  const handleConfirm = async () => {
    if (!imgRef.current) return;

    const cropToProcess = completedCrop || (crop ? convertToPixelCrop(crop, imgRef.current.width, imgRef.current.height) : undefined);
    if (!cropToProcess) return;

    setIsProcessing(true);
    try {
      const croppedBlob = await getCroppedImg(imgRef.current, cropToProcess);
      onCropComplete(croppedBlob);
      onOpenChange(false);
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setScale(1);
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      const resetCrop = centerAspectCrop(width, height, aspectRatio);
      setCrop(resetCrop);
      setCompletedCrop(convertToPixelCrop(resetCrop, width, height));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajustar Foto</DialogTitle>
          <DialogDescription>
            Arraste para posicionar e redimensionar. Tamanho recomendado: {suggestedSize.width}×{suggestedSize.height}px (quadrado)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Crop area */}
          <div className="relative flex items-center justify-center bg-muted/50 rounded-lg overflow-hidden min-h-[300px]">
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspectRatio}
              minWidth={minSize}
              minHeight={minSize}
              circularCrop
              className="max-h-[400px]"
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Imagem para recorte"
                onLoad={onImageLoad}
                style={{
                  transform: `scale(${scale})`,
                  maxHeight: '400px',
                  width: 'auto'
                }}
                className="transition-transform"
              />
            </ReactCrop>
          </div>

          {/* Zoom control */}
          <div className="flex items-center gap-3 px-2">
            <ZoomOut className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[scale]}
              onValueChange={([val]) => setScale(val)}
              min={0.5}
              max={2}
              step={0.1}
              className="flex-1"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleReset}
              className="ml-2"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          {/* Tips */}
          <p className="text-xs text-muted-foreground text-center">
            💡 Dica: Centralize seu rosto na área circular para melhor visualização
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!completedCrop || isProcessing}
          >
            <Check className="h-4 w-4 mr-2" />
            {isProcessing ? 'Processando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

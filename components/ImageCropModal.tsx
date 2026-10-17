'use client';

import React, { useState, useRef, useEffect } from 'react';

interface ImageCropModalProps {
  isOpen: boolean;
  file: File | null;
  /** width / height, e.g. 1 for square profile, 3 for wide banner */
  aspectRatio: number;
  title: string;
  onConfirm: (croppedFile: File) => void;
  onCancel: () => void;
}

/**
 * Lightweight image crop modal: lets the user pan (drag) and zoom (slider)
 * an image inside a fixed-aspect-ratio viewport, then renders the visible
 * region to a canvas at high resolution and returns it as a JPEG File.
 *
 * Used by ProfileView and AddArtistView so the user can crop a square
 * profile picture and a wide banner to the exact size the app expects.
 *
 * No external deps — only React + DOM canvas. Pointer events for desktop,
 * touch events for mobile.
 */
export function ImageCropModal({
  isOpen,
  file,
  aspectRatio,
  title,
  onConfirm,
  onCancel,
}: ImageCropModalProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, ox: 0, oy: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Manage object URL lifecycle tied to the file prop
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      return () => {
        URL.revokeObjectURL(url);
        setImageUrl(null);
      };
    }
  }, [file]);

  // Reset crop state every time the modal opens
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setNatural({ w: 0, h: 0 });
    }
  }, [isOpen, file]);

  // Track container size (responsive) so the crop math is always correct
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const updateSize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setContainerSize({ w: rect.width, h: rect.height });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [isOpen]);

  if (!isOpen || !file || !imageUrl) return null;

  // Calculate cover dimensions for the image at zoom = 1
  const CW = containerSize.w;
  const CH = containerSize.h;
  const NW = natural.w;
  const NH = natural.h;

  let coverScale = 1;
  let IW = 0;
  let IH = 0;
  if (CW > 0 && CH > 0 && NW > 0 && NH > 0) {
    coverScale = Math.max(CW / NW, CH / NH);
    IW = NW * coverScale;
    IH = NH * coverScale;
  }

  const dispW = IW * zoom;
  const dispH = IH * zoom;
  const imgLeft = (CW - dispW) / 2 + offset.x;
  const imgTop = (CH - dispH) / 2 + offset.y;

  const startDrag = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setDragStart({ x: clientX, y: clientY, ox: offset.x, oy: offset.y });
  };

  const moveDrag = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const dx = clientX - dragStart.x;
    const dy = clientY - dragStart.y;
    // Constrain so image always fully covers the container
    const maxOffsetX = Math.max(0, (dispW - CW) / 2);
    const maxOffsetY = Math.max(0, (dispH - CH) / 2);
    const newOffsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, dragStart.ox + dx));
    const newOffsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, dragStart.oy + dy));
    setOffset({ x: newOffsetX, y: newOffsetY });
  };

  const endDrag = () => setIsDragging(false);

  const handleConfirm = () => {
    if (!imageRef.current || CW === 0 || CH === 0 || NW === 0 || NH === 0) return;

    // High-res output: 2x the visible viewport, capped at 1200px wide
    const OUT_W = Math.min(1200, Math.round(CW * 2));
    const OUT_H = Math.round(OUT_W / aspectRatio);

    const canvas = document.createElement('canvas');
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Total scale from natural image coords → displayed image coords
    const totalScale = coverScale * zoom;

    // Visible region of the displayed image inside the container (in display coords)
    const visLeftDisp = Math.max(0, -imgLeft);
    const visTopDisp = Math.max(0, -imgTop);
    const visRightDisp = Math.min(dispW, CW - imgLeft);
    const visBottomDisp = Math.min(dispH, CH - imgTop);

    // Convert to natural image coords (source rect for drawImage)
    const sx = visLeftDisp / totalScale;
    const sy = visTopDisp / totalScale;
    const sw = (visRightDisp - visLeftDisp) / totalScale;
    const sh = (visBottomDisp - visTopDisp) / totalScale;

    if (sw <= 0 || sh <= 0) return;

    ctx.drawImage(imageRef.current, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const baseName = (file.name || 'cropped').replace(/\.[^.]+$/, '');
        const croppedFile = new File([blob], `${baseName}-cropped.jpg`, { type: 'image/jpeg' });
        onConfirm(croppedFile);
      },
      'image/jpeg',
      0.92
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onTouchEnd={endDrag}
    >
      <div className="bg-[var(--bg)] rounded-[6px] p-3 max-w-md w-full space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[var(--text)] text-sm">{title}</span>
          <button
            type="button"
            onClick={onCancel}
            className="text-[var(--text-muted)] hover:text-[var(--text)] text-xs underline cursor-pointer"
          >
            Cancel
          </button>
        </div>

        {/* Crop viewport — fixed aspect ratio */}
        <div
          ref={containerRef}
          className="relative w-full overflow-hidden bg-[var(--bg-hover)] border border-[var(--border-light)] cursor-move select-none rounded-[3px]"
          style={{ aspectRatio: `${aspectRatio}` }}
          onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
          onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
          onTouchStart={(e) => {
            if (e.touches[0]) startDrag(e.touches[0].clientX, e.touches[0].clientY);
          }}
          onTouchMove={(e) => {
            if (e.touches[0]) moveDrag(e.touches[0].clientX, e.touches[0].clientY);
          }}
        >
          {imageUrl && (
            <img
              ref={imageRef}
              src={imageUrl}
              alt="crop preview"
              onLoad={(e) => {
                const img = e.currentTarget;
                setNatural({ w: img.naturalWidth, h: img.naturalHeight });
              }}
              className="absolute pointer-events-none max-w-none"
              style={{
                width: `${dispW}px`,
                height: `${dispH}px`,
                left: `${imgLeft}px`,
                top: `${imgTop}px`,
              }}
              draggable={false}
            />
          )}
        </div>

        {/* Zoom slider + reset */}
        <div className="space-y-2">
          <label className="block text-[11px] text-[var(--text-muted)]">Zoom</label>
          <input
            type="range"
            min="1"
            max="4"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-full cursor-pointer"
          />
          <div className="flex items-center justify-between text-[10px] text-[var(--text-faint)]">
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              }}
              className="underline cursor-pointer hover:text-[var(--text)]"
            >
              Reset
            </button>
            <span>Drag to reposition</span>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-1.5 bg-[var(--accent)] text-[var(--accent-text)] border border-[var(--border)] rounded-[3px] text-xs hover:bg-[var(--accent-hover)] cursor-pointer"
          >
            Apply crop
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 bg-[var(--bg)] text-[var(--text)] border border-[var(--border-light)] rounded-[3px] text-xs hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

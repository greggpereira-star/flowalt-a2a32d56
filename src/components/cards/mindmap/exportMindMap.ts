import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import type { MindMapNode } from './types';

/**
 * Computes the bounding box of all nodes to set up a proper export viewport.
 */
function getNodesBounds(nodes: MindMapNode[]) {
  if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 800, maxY: 600 };

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const w = n.nodeWidth || 160;
    const h = 60; // approximate node height
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + w > maxX) maxX = n.x + w;
    if (n.y + h > maxY) maxY = n.y + h;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Captures the mind map canvas as a PNG data URL.
 * We temporarily reset pan/zoom so the capture is clean.
 */
export async function exportMindMapAsPng(
  containerRef: HTMLDivElement,
  nodes: MindMapNode[],
  filename = 'mapa-mental'
): Promise<void> {
  const bounds = getNodesBounds(nodes);
  const padding = 60;
  const width = bounds.maxX - bounds.minX + padding * 2;
  const height = bounds.maxY - bounds.minY + padding * 2;

  // Clone the container so we can manipulate it without affecting the UI
  const clone = containerRef.cloneNode(true) as HTMLDivElement;
  clone.style.position = 'fixed';
  clone.style.top = '-99999px';
  clone.style.left = '-99999px';
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.overflow = 'visible';
  clone.style.background = 'white';

  // Reset transforms on child elements (SVG + nodes container)
  const transformChildren = clone.querySelectorAll<HTMLElement>('.mindmap-canvas > svg, .mindmap-canvas > div');
  transformChildren.forEach(el => {
    el.style.transform = `translate(${-bounds.minX + padding}px, ${-bounds.minY + padding}px) scale(1)`;
    el.style.transformOrigin = '0 0';
  });

  // Also fix the main canvas
  const canvas = clone.querySelector<HTMLElement>('.mindmap-canvas');
  if (canvas) {
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.background = 'white';
    canvas.style.backgroundImage = 'none';
  }

  // Hide toolbars in clone
  clone.querySelectorAll<HTMLElement>('.absolute.bottom-4, .absolute.right-3, [class*="z-30"]').forEach(el => {
    el.style.display = 'none';
  });

  document.body.appendChild(clone);

  try {
    const dataUrl = await toPng(clone, {
      width,
      height,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      style: {
        transform: 'none',
      },
    });

    // Download
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = dataUrl;
    link.click();
  } finally {
    document.body.removeChild(clone);
  }
}

export async function exportMindMapAsPdf(
  containerRef: HTMLDivElement,
  nodes: MindMapNode[],
  filename = 'mapa-mental'
): Promise<void> {
  const bounds = getNodesBounds(nodes);
  const padding = 60;
  const width = bounds.maxX - bounds.minX + padding * 2;
  const height = bounds.maxY - bounds.minY + padding * 2;

  const clone = containerRef.cloneNode(true) as HTMLDivElement;
  clone.style.position = 'fixed';
  clone.style.top = '-99999px';
  clone.style.left = '-99999px';
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.overflow = 'visible';
  clone.style.background = 'white';

  const transformChildren = clone.querySelectorAll<HTMLElement>('.mindmap-canvas > svg, .mindmap-canvas > div');
  transformChildren.forEach(el => {
    el.style.transform = `translate(${-bounds.minX + padding}px, ${-bounds.minY + padding}px) scale(1)`;
    el.style.transformOrigin = '0 0';
  });

  const canvas = clone.querySelector<HTMLElement>('.mindmap-canvas');
  if (canvas) {
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.background = 'white';
    canvas.style.backgroundImage = 'none';
  }

  clone.querySelectorAll<HTMLElement>('.absolute.bottom-4, .absolute.right-3, [class*="z-30"]').forEach(el => {
    el.style.display = 'none';
  });

  document.body.appendChild(clone);

  try {
    const dataUrl = await toPng(clone, {
      width,
      height,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
    });

    const isLandscape = width > height;
    const pdf = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'px',
      format: [width, height],
    });

    pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
    pdf.save(`${filename}.pdf`);
  } finally {
    document.body.removeChild(clone);
  }
}

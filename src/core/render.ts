import { zipSync } from 'fflate';
import { cropToRatio, outputDimensions, safeFilename, type Tile } from './split.ts';

export type ExportSettings = {
  format: 'png' | 'jpeg' | 'webp';
  quality: number;
  ratio: number | null;
  targetWidth: number | null;
  border: number;
  borderColor: string;
  radius: number;
  filename: string;
};

export const defaultExport: ExportSettings = {
  format: 'png', quality: 95, ratio: null, targetWidth: null,
  border: 0, borderColor: '#ffffff', radius: 0, filename: '图片切割',
};

export function tileDimensions(tile: Tile, settings: ExportSettings) {
  return outputDimensions(cropToRatio(tile, settings.ratio), settings.targetWidth, settings.border);
}

export function renderTile(image: HTMLImageElement, tile: Tile, settings: ExportSettings, preview = false): HTMLCanvasElement {
  const rect = cropToRatio(tile, settings.ratio);
  const size = outputDimensions(rect, settings.targetWidth, settings.border);
  if (size.width > 16384 || size.height > 16384 || size.width * size.height > 32_000_000) {
    throw new Error('单张输出尺寸过大，请减少每块宽度或增加切块数量（单张最多 3200 万像素）');
  }
  const scale = preview ? Math.min(1, 300 / size.width, 220 / size.height) : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(size.width * scale));
  canvas.height = Math.max(1, Math.round(size.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('浏览器无法创建画布，请重新打开工具');
  ctx.scale(canvas.width / size.width, canvas.height / size.height);
  // JPEG 没有透明通道，圆角之外和透明像素使用用户选择的底色。
  if (settings.format === 'jpeg') {
    ctx.fillStyle = settings.borderColor;
    ctx.fillRect(0, 0, size.width, size.height);
  }
  const radius = Math.min(size.width, size.height) * settings.radius / 100;
  ctx.beginPath();
  ctx.roundRect(0, 0, size.width, size.height, radius);
  ctx.clip();
  if (settings.border > 0) {
    ctx.fillStyle = settings.borderColor;
    ctx.fillRect(0, 0, size.width, size.height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height,
    settings.border, settings.border, size.imageWidth, size.imageHeight);
  return canvas;
}

export function canvasBlob(canvas: HTMLCanvasElement, settings: ExportSettings): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) reject(new Error('图片编码失败，请尝试减小图片尺寸'));
      else if (blob.type !== `image/${settings.format}`) reject(new Error('当前浏览器不支持该格式，请选择 PNG 或 JPG'));
      else resolve(blob);
    }, `image/${settings.format}`, settings.quality / 100);
  });
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function tileFilename(settings: ExportSettings, tile: Tile, count: number) {
  const ext = settings.format === 'jpeg' ? 'jpg' : settings.format;
  return `${safeFilename(settings.filename)}_${String(tile.number).padStart(Math.max(2, String(count).length), '0')}.${ext}`;
}

export async function exportZip(image: HTMLImageElement, tiles: Tile[], settings: ExportSettings, progress: (done: number) => void) {
  const totalPixels = tiles.reduce((total, tile) => {
    const size = tileDimensions(tile, settings);
    return total + size.width * size.height;
  }, 0);
  if (totalPixels > 120_000_000) throw new Error('总输出超过 1.2 亿像素，请减小输出宽度，或逐张下载');
  const files: Record<string, Uint8Array> = {};
  for (let i = 0; i < tiles.length; i++) {
    const canvas = renderTile(image, tiles[i], settings);
    const blob = await canvasBlob(canvas, settings);
    canvas.width = canvas.height = 1;
    files[tileFilename(settings, tiles[i], tiles.length)] = new Uint8Array(await blob.arrayBuffer());
    progress(i + 1);
    // 逐张编码并让出主线程，保持进度和交互可响应。
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  const zip = zipSync(files, { level: 0 });
  return new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
}

export type Rect = { x: number; y: number; width: number; height: number };
export type Tile = Rect & { number: number; row: number; col: number };
export const MAX_TILES = 400;

function positiveInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name}必须是大于 0 的整数`);
}

export function equalCuts(length: number, count: number): number[] {
  positiveInteger(length, '图片尺寸');
  positiveInteger(count, '切割数量');
  if (count > length || count > MAX_TILES) throw new Error('切割数量过多，每块至少需要 1 像素');
  return Array.from({ length: count - 1 }, (_, i) => Math.round(length * (i + 1) / count) / length);
}

export function pixelCuts(length: number, span: number): number[] {
  positiveInteger(length, '图片尺寸');
  positiveInteger(span, '切块尺寸');
  const count = Math.ceil(length / span);
  if (count > MAX_TILES) throw new Error(`最多支持 ${MAX_TILES} 个切块，请增大切块尺寸`);
  return Array.from({ length: count - 1 }, (_, i) => span * (i + 1) / length);
}

export function makeTiles(width: number, height: number, xCuts: number[], yCuts: number[], reverse = false): Tile[] {
  positiveInteger(width, '图片宽度');
  positiveInteger(height, '图片高度');
  const total = (xCuts.length + 1) * (yCuts.length + 1);
  if (total > MAX_TILES) throw new Error(`最多支持 ${MAX_TILES} 个切块，请减少行列数或增大切块尺寸`);
  const x = [0, ...xCuts.map(cut => Math.round(cut * width)), width];
  const y = [0, ...yCuts.map(cut => Math.round(cut * height)), height];
  if (x.some((v, i) => i > 0 && v <= x[i - 1]) || y.some((v, i) => i > 0 && v <= y[i - 1])) {
    throw new Error('切割线必须有序且每块至少需要 1 像素');
  }
  return y.slice(0, -1).flatMap((top, row) => x.slice(0, -1).map((left, col) => {
    const index = row * (x.length - 1) + col;
    return { x: left, y: top, width: x[col + 1] - left, height: y[row + 1] - top, row, col, number: reverse ? total - index : index + 1 };
  }));
}

export function cropToRatio(rect: Rect, ratio: number | null): Rect {
  if (ratio === null) return { ...rect };
  if (!Number.isFinite(ratio) || ratio <= 0) throw new Error('裁剪比例无效');
  let { width, height } = rect;
  if (width / height > ratio) width = Math.max(1, Math.round(height * ratio));
  else height = Math.max(1, Math.round(width / ratio));
  return { x: rect.x + Math.floor((rect.width - width) / 2), y: rect.y + Math.floor((rect.height - height) / 2), width, height };
}

export function moveCut(cuts: number[], index: number, position: number, length: number): number[] {
  const result = [...cuts];
  const min = Math.round((cuts[index - 1] ?? 0) * length) + 1;
  const max = Math.round((cuts[index + 1] ?? 1) * length) - 1;
  result[index] = Math.min(max, Math.max(min, Math.round(position * length))) / length;
  return result;
}

export function outputDimensions(rect: Pick<Rect, 'width' | 'height'>, targetWidth: number | null, border: number) {
  const imageWidth = targetWidth ?? rect.width;
  const imageHeight = Math.max(1, Math.round(rect.height * imageWidth / rect.width));
  return { width: imageWidth + border * 2, height: imageHeight + border * 2, imageWidth, imageHeight };
}

export function safeFilename(name: string): string {
  return name.trim().replace(/\.[a-z0-9]+$/i, '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/[. ]+$/, '').slice(0, 100) || '图片切割';
}

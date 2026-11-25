export type Size = { width: number; height: number };
export type ViewMode = 'fit' | 'width' | number;
export const CANVAS_PADDING = 24;

export function defaultView(image: Size): ViewMode {
  return image.height > image.width * 2 ? 'width' : 'fit';
}

export function previewSize(image: Size, viewport: Size, mode: ViewMode) {
  const widthScale = Math.max(1, viewport.width - CANVAS_PADDING * 2) / image.width;
  const heightScale = Math.max(1, viewport.height - CANVAS_PADDING * 2) / image.height;
  const scale = typeof mode === 'number' ? Math.min(3, Math.max(0.01, mode))
    : mode === 'width' ? widthScale : Math.min(widthScale, heightScale, 1);
  return { width: image.width * scale, height: image.height * scale, scale };
}

export function zoomAtCenter(scroll: { left: number; top: number }, viewport: Size, before: Size, after: Size) {
  const axis = (offset: number, available: number, oldLength: number, newLength: number) => {
    const oldOrigin = Math.max(CANVAS_PADDING, (available - oldLength) / 2);
    const newOrigin = Math.max(CANVAS_PADDING, (available - newLength) / 2);
    const position = (offset + available / 2 - oldOrigin) / oldLength;
    return Math.max(0, newOrigin + position * newLength - available / 2);
  };
  return { left: axis(scroll.left, viewport.width, before.width, after.width), top: axis(scroll.top, viewport.height, before.height, after.height) };
}

export function edgeScrollSpeed(position: number, start: number, end: number): number {
  const threshold = Math.min(40, (end - start) / 4);
  if (position < start + threshold) return -Math.min(16, Math.max(0, (start + threshold - position) / threshold * 16));
  if (position > end - threshold) return Math.min(16, Math.max(0, (position - end + threshold) / threshold * 16));
  return 0;
}

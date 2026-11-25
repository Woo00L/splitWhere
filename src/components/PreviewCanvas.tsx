import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { moveCut, type Tile } from '../core/split';
import { CANVAS_PADDING, defaultView, edgeScrollSpeed, previewSize, zoomAtCenter, type ViewMode } from '../core/viewport';
import type { LoadedImage } from './Preview';

type Props = {
  image: LoadedImage; tiles: Tile[]; xCuts: number[]; yCuts: number[];
  setCuts: (axis: 'x' | 'y', cuts: number[]) => void;
  showNumbers: boolean; disabled: boolean;
};

export default function PreviewCanvas({ image, tiles, xCuts, yCuts, setCuts, showNumbers, disabled }: Props) {
  const naturalSize = { width: image.element.naturalWidth, height: image.element.naturalHeight };
  const [mode, setMode] = useState<ViewMode>(() => defaultView(naturalSize));
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const [dragging, setDragging] = useState<string | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const animation = useRef<number | null>(null);
  const activeDrag = useRef<{ axis: 'x' | 'y'; index: number; x: number; y: number } | null>(null);
  const latest = useRef({ xCuts, yCuts, setCuts });
  latest.current = { xCuts, yCuts, setCuts };
  const pendingScroll = useRef<{ left: number; top: number } | null>(null);
  const size = previewSize(naturalSize, viewport, mode);

  useLayoutEffect(() => {
    const element = area.current;
    if (!element) return;
    const measure = () => setViewport({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (area.current && pendingScroll.current) {
      area.current.scrollLeft = pendingScroll.current.left;
      area.current.scrollTop = pendingScroll.current.top;
      pendingScroll.current = null;
    }
  }, [size.width, size.height, mode]);

  useEffect(() => () => { if (animation.current !== null) cancelAnimationFrame(animation.current); }, []);

  const changeMode = (next: ViewMode) => {
    if (area.current) {
      pendingScroll.current = typeof next === 'number'
        ? zoomAtCenter({ left: area.current.scrollLeft, top: area.current.scrollTop }, viewport, size, previewSize(naturalSize, viewport, next))
        : { left: 0, top: 0 };
    }
    setMode(next);
  };

  const updateCut = () => {
    const drag = activeDrag.current;
    if (!drag || !frame.current) return;
    // 始终从滚动、缩放后的实际图片边界换算原图坐标。
    const bounds = frame.current.getBoundingClientRect();
    const cuts = drag.axis === 'x' ? latest.current.xCuts : latest.current.yCuts;
    const position = drag.axis === 'x' ? (drag.x - bounds.left) / bounds.width : (drag.y - bounds.top) / bounds.height;
    const length = drag.axis === 'x' ? naturalSize.width : naturalSize.height;
    const next = moveCut(cuts, drag.index, position, length);
    if (next[drag.index] !== cuts[drag.index]) latest.current.setCuts(drag.axis, next);
  };

  const scrollWhileDragging = () => {
    const drag = activeDrag.current;
    const element = area.current;
    if (!drag || !element) return;
    const bounds = element.getBoundingClientRect();
    if (drag.axis === 'x') element.scrollLeft += edgeScrollSpeed(drag.x, bounds.left, bounds.right);
    else element.scrollTop += edgeScrollSpeed(drag.y, bounds.top, bounds.bottom);
    updateCut();
    animation.current = requestAnimationFrame(scrollWhileDragging);
  };

  const stopDrag = () => {
    activeDrag.current = null;
    setDragging(null);
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    animation.current = null;
  };

  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!activeDrag.current) return;
    activeDrag.current.x = event.clientX;
    activeDrag.current.y = event.clientY;
    updateCut();
  };

  const cutLine = (axis: 'x' | 'y', value: number, index: number) => {
    const length = axis === 'x' ? naturalSize.width : naturalSize.height;
    return <button type="button" key={`${axis}-${index}`} role="slider" aria-label={`${axis === 'x' ? '垂直' : '水平'}切割线 ${index + 1}`}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-valuetext={`${Math.round(value * length)} 像素`} disabled={disabled}
      className={`cut-line ${axis === 'x' ? 'vertical' : 'horizontal'} ${dragging === `${axis}${index}` ? 'dragging' : ''}`}
      style={axis === 'x' ? { left: `${value * 100}%` } : { top: `${value * 100}%` }}
      onPointerDown={event => {
        event.currentTarget.setPointerCapture(event.pointerId);
        activeDrag.current = { axis, index, x: event.clientX, y: event.clientY };
        setDragging(`${axis}${index}`);
        animation.current = requestAnimationFrame(scrollWhileDragging);
      }} onPointerMove={pointerMove} onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={stopDrag}
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const direction = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
        setCuts(axis, moveCut(axis === 'x' ? xCuts : yCuts, index, value + direction * (event.shiftKey ? 10 : 1) / length, length));
      }}><span /></button>;
  };

  return <div className="canvas-viewer">
    <div className="zoom-toolbar" role="group" aria-label="预览缩放">
      <div className="view-modes"><button aria-pressed={mode === 'fit'} onClick={() => changeMode('fit')}>全图</button><button aria-pressed={mode === 'width'} onClick={() => changeMode('width')}>适合宽度</button><button aria-label="原始大小 100%" aria-pressed={mode === 1} onClick={() => changeMode(1)}>100%</button></div>
      <div className="zoom-controls"><button className="icon-button" aria-label="缩小预览" disabled={size.scale <= 0.01} onClick={() => changeMode(size.scale / 1.25)}><Minus size={14} /></button><input type="range" aria-label="预览缩放比例" min="1" max="300" value={Math.max(1, Math.round(size.scale * 100))} onChange={event => changeMode(Number(event.target.value) / 100)} /><output aria-label="当前预览缩放">{Math.round(size.scale * 100)}%</output><button className="icon-button" aria-label="放大预览" disabled={size.scale >= 3} onClick={() => changeMode(size.scale * 1.25)}><Plus size={14} /></button></div>
    </div>
    <div className="canvas-area" ref={area} tabIndex={0} role="region" aria-label="可滚动切割画布">
      <div className="canvas-stage" style={{ width: Math.max(viewport.width, size.width + CANVAS_PADDING * 2), height: Math.max(viewport.height, size.height + CANVAS_PADDING * 2) }}>
        <div className="image-frame" ref={frame} style={{ width: size.width, height: size.height }}>
          <img className="source-image" src={image.url} alt="待切割的原图" draggable={false} />
          {showNumbers && tiles.map(tile => <span className="tile-number" key={`${tile.row}-${tile.col}`} style={{ left: `${(tile.x + tile.width / 2) / naturalSize.width * 100}%`, top: `${(tile.y + tile.height / 2) / naturalSize.height * 100}%` }}>{tile.number}</span>)}
          {xCuts.map((value, index) => cutLine('x', value, index))}
          {yCuts.map((value, index) => cutLine('y', value, index))}
        </div>
      </div>
    </div>
  </div>;
}

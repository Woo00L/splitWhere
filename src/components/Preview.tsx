import { ImagePlus, Maximize, MousePointer2, Replace, Scissors, ShieldCheck, Trash2, Upload, WandSparkles } from 'lucide-react';
import { useRef, useState, type PointerEvent } from 'react';
import { moveCut, type Tile } from '../core/split';

export type LoadedImage = { element: HTMLImageElement; url: string; name: string; size: number };
type Props = {
  image: LoadedImage | null; tiles: Tile[]; xCuts: number[]; yCuts: number[];
  setCuts: (axis: 'x' | 'y', cuts: number[]) => void; choose: () => void;
  remove: () => void; sample: () => void; resetCuts: () => void;
  error: string | null; loading: boolean; disabled: boolean;
};

export default function Preview({ image, tiles, xCuts, yCuts, setCuts, choose, remove, sample, resetCuts, error, loading, disabled }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const [showNumbers, setShowNumbers] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const dragState = useRef<{ axis: 'x' | 'y'; index: number } | null>(null);

  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!dragState.current || !frame.current || !image) return;
    const { axis, index } = dragState.current;
    const rect = frame.current.getBoundingClientRect();
    const position = axis === 'x' ? (event.clientX - rect.left) / rect.width : (event.clientY - rect.top) / rect.height;
    setCuts(axis, moveCut(axis === 'x' ? xCuts : yCuts, index, position, axis === 'x' ? image.element.naturalWidth : image.element.naturalHeight));
  };

  const cutLine = (axis: 'x' | 'y', value: number, index: number) => <button type="button" key={`${axis}-${index}`} role="slider" aria-label={`${axis === 'x' ? '垂直' : '水平'}切割线 ${index + 1}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} disabled={disabled}
    className={`cut-line ${axis === 'x' ? 'vertical' : 'horizontal'} ${dragging === `${axis}${index}` ? 'dragging' : ''}`}
    style={axis === 'x' ? { left: `${value * 100}%` } : { top: `${value * 100}%` }}
    onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); dragState.current = { axis, index }; setDragging(`${axis}${index}`); }}
    onPointerMove={pointerMove}
    onPointerUp={() => { dragState.current = null; setDragging(null); }}
    onPointerCancel={() => { dragState.current = null; setDragging(null); }}
    onKeyDown={event => {
      if (!image || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const length = axis === 'x' ? image.element.naturalWidth : image.element.naturalHeight;
      const direction = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
      setCuts(axis, moveCut(axis === 'x' ? xCuts : yCuts, index, value + direction * (event.shiftKey ? 10 : 1) / length, length));
    }}><span /></button>;

  return <section className={`preview-panel ${expanded ? 'expanded' : ''}`} aria-label="图片预览">
    <div className="panel-heading"><h2><Scissors size={17} />{image ? '切割预览' : '导入图片'}</h2><div className="preview-actions">{image && <>
      <button className={`icon-button number-toggle ${showNumbers ? 'enabled' : ''}`} aria-label="显示切块编号" aria-pressed={showNumbers} onClick={() => setShowNumbers(!showNumbers)}>#</button>
      <button className="icon-button" aria-label={expanded ? '退出大图预览' : '大图预览'} onClick={() => setExpanded(!expanded)}><Maximize size={16} /></button>
    </>}</div></div>
    {image ? <>
      <div className="image-file-row"><div className="file-description"><div className="file-icon"><ImagePlus size={18} /></div><div><strong title={image.name}>{image.name}</strong><span>{image.element.naturalWidth.toLocaleString()} × {image.element.naturalHeight.toLocaleString()} px <i />{image.size > 1024 * 1024 ? `${(image.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(image.size / 1024))} KB`}</span></div></div><div className="file-actions"><button className="subtle-button" disabled={disabled} onClick={choose}><Replace size={14} />换一张</button><button className="icon-button danger" aria-label="移除图片" disabled={disabled} onClick={remove}><Trash2 size={15} /></button></div></div>
      <div className="canvas-area"><div className="image-frame" ref={frame} style={{ aspectRatio: `${image.element.naturalWidth}/${image.element.naturalHeight}`, maxWidth: `min(100%, ${(expanded ? 68 : 45) * image.element.naturalWidth / image.element.naturalHeight}vh)` }}>
        <img className="source-image" src={image.url} alt="待切割的原图" draggable={false} />
        {showNumbers && tiles.map(tile => <span className="tile-number" key={`${tile.row}-${tile.col}`} style={{ left: `${(tile.x + tile.width / 2) / image.element.naturalWidth * 100}%`, top: `${(tile.y + tile.height / 2) / image.element.naturalHeight * 100}%` }}>{tile.number}</span>)}
        {xCuts.map((value, index) => cutLine('x', value, index))}
        {yCuts.map((value, index) => cutLine('y', value, index))}
      </div></div>
      <div className="preview-status"><span><span className="status-dot" />{tiles.length} 个切块<span className="separator">/</span>{xCuts.length + 1} 列 × {yCuts.length + 1} 行</span><button className="text-button" disabled={disabled} onClick={resetCuts}>均匀分布切割线</button></div>
      <div className="canvas-tip"><MousePointer2 size={13} /><span>拖动粉色切割线，微调你想保留的画面</span></div>
    </> : <div className="upload-empty"><div className="upload-graphic" aria-hidden="true"><span /><span /><span /><span /><div><Scissors size={27} /></div></div><h3>{loading ? '正在读取图片…' : '好作品，从一张图片开始'}</h3><p>把图片拖到这里，或直接粘贴</p><button className="primary-button" onClick={choose} disabled={loading}><Upload size={17} />选择图片</button><span className="supported">JPG、PNG、WebP、GIF、BMP、AVIF</span><div className="sample-divider"><span />或者<span /></div><button className="sample-button" disabled={loading} onClick={sample}><WandSparkles size={15} />用示例图试试<span>↗</span></button><div className="privacy-note"><ShieldCheck size={14} />图片只在你的设备上处理，绝不上传</div></div>}
    {error && <div className="error-message" role="alert">{error}</div>}
  </section>;
}

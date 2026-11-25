import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Check, ChevronRight, CircleHelp, LockKeyhole, Scissors, ShieldCheck, Upload, X } from 'lucide-react';
import Preview, { type LoadedImage } from './components/Preview';
import Settings, { defaultLayout, type LayoutSettings } from './components/Settings';
import Results from './components/Results';
import { equalCuts, makeTiles, pixelCuts, safeFilename, type Tile } from './core/split';
import { canvasBlob, defaultExport, download, exportZip, renderTile, tileFilename, type ExportSettings } from './core/render';
import sampleUrl from './assets/sample.webp';

export default function App() {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [layout, setLayout] = useState<LayoutSettings>(defaultLayout);
  const [output, setOutput] = useState<ExportSettings>(defaultExport);
  const [customCuts, setCustomCuts] = useState<{ x: number[]; y: number[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [archive, setArchive] = useState<{ url: string; name: string } | null>(null);
  const archiveUrl = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const requestId = useRef(0);
  const imageRef = useRef<LoadedImage | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const loadFile = useCallback(async (file: File) => {
    const id = ++requestId.current;
    setError(null);
    setLoading(false);
    if (!/\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(file.name) && !/^image\/(jpeg|png|webp|gif|bmp|avif)$/.test(file.type)) {
      setError('请选择 JPG、PNG、WebP、GIF、BMP 或 AVIF 图片。');
      return;
    }
    if (file.size > 80 * 1024 * 1024) { setError('图片文件超过 80 MB，请先压缩或缩小图片。'); return; }
    setLoading(true);
    let url = URL.createObjectURL(file);
    try {
      const element = new window.Image();
      element.src = url;
      await element.decode();
      if (id !== requestId.current) { URL.revokeObjectURL(url); return; }
      if (element.naturalWidth * element.naturalHeight > 80_000_000 || element.naturalWidth > 32768 || element.naturalHeight > 32768) {
        throw new Error('图片尺寸过大，请使用 8000 万像素以内、边长不超过 32768 px 的图片。');
      }
      // 动图在读取时冻结为静态画面，确保预览与后续导出使用同一帧。
      const bitmap = await createImageBitmap(element);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { bitmap.close(); throw new Error('浏览器无法读取图片'); }
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      const frozen = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片读取失败，请尝试较小的文件')), 'image/png'));
      canvas.width = canvas.height = 1;
      URL.revokeObjectURL(url);
      url = URL.createObjectURL(frozen);
      element.src = url;
      await element.decode();
      if (id !== requestId.current) { URL.revokeObjectURL(url); return; }
      if (imageRef.current) URL.revokeObjectURL(imageRef.current.url);
      const next = { element, url, name: file.name, size: file.size };
      imageRef.current = next;
      setImage(next);
      setCustomCuts(null);
      setLayout(current => ({ ...current, cols: Math.min(current.cols, element.naturalWidth), rows: Math.min(current.rows, element.naturalHeight) }));
      setOutput(current => ({ ...current, filename: safeFilename(file.name) }));
    } catch (failure) {
      URL.revokeObjectURL(url);
      if (id === requestId.current) setError(failure instanceof Error && !failure.message.includes('decode') ? failure.message : '无法读取这张图片，文件可能已损坏或格式不受浏览器支持。');
    } finally { if (id === requestId.current) setLoading(false); }
  }, []);

  useEffect(() => () => {
    requestId.current++;
    if (imageRef.current) URL.revokeObjectURL(imageRef.current.url);
    if (archiveUrl.current) URL.revokeObjectURL(archiveUrl.current);
    clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    if (archiveUrl.current) URL.revokeObjectURL(archiveUrl.current);
    archiveUrl.current = null;
    setArchive(null);
  }, [image, layout, customCuts, output]);

  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      if (busy || ['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName)) return;
      const file = Array.from(event.clipboardData?.files ?? []).find(f => f.type.startsWith('image/'));
      if (file) { event.preventDefault(); void loadFile(file); }
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setHelpOpen(false); };
    document.addEventListener('paste', paste);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('paste', paste); document.removeEventListener('keydown', key); };
  }, [loadFile, busy]);

  const calculated = useMemo(() => {
    if (!image) return { x: [], y: [], tiles: [], error: null };
    try {
      const { naturalWidth: w, naturalHeight: h } = image.element;
      const x = customCuts?.x ?? (layout.mode === 'grid' ? equalCuts(w, layout.cols) : pixelCuts(w, layout.pixelWidth));
      const y = customCuts?.y ?? (layout.mode === 'grid' ? equalCuts(h, layout.rows) : pixelCuts(h, layout.pixelHeight));
      return { x, y, tiles: makeTiles(w, h, x, y, layout.reverse), error: null };
    } catch (failure) { return { x: [], y: [], tiles: [], error: (failure as Error).message }; }
  }, [image, layout, customCuts]);

  const updateLayout = (next: LayoutSettings) => {
    if (next.cols !== layout.cols || next.rows !== layout.rows || next.mode !== layout.mode || next.pixelWidth !== layout.pixelWidth || next.pixelHeight !== layout.pixelHeight) setCustomCuts(null);
    setLayout(next);
  };
  const reset = () => { setLayout(defaultLayout); setOutput({ ...defaultExport, filename: image ? safeFilename(image.name) : defaultExport.filename }); setCustomCuts(null); setError(null); };
  const remove = () => {
    requestId.current++;
    if (imageRef.current) URL.revokeObjectURL(imageRef.current.url);
    imageRef.current = null;
    setImage(null); setCustomCuts(null); setError(null); setLoading(false);
  };
  const loadSample = async () => {
    try { const blob = await (await fetch(sampleUrl)).blob(); await loadFile(new File([blob], '日落山湖.webp', { type: 'image/webp' })); }
    catch { setError('示例图片读取失败，请选择你自己的图片。'); }
  };

  const downloadOne = async (tile: Tile) => {
    if (!image || busy) return;
    try {
      const canvas = renderTile(image.element, tile, output);
      const blob = await canvasBlob(canvas, output);
      canvas.width = canvas.height = 1;
      download(blob, tileFilename(output, tile, calculated.tiles.length));
      notify(`切块 ${tile.number} 已下载`);
    } catch (failure) { notify((failure as Error).message); }
  };
  const copyOne = async (tile: Tile) => {
    if (!image) return false;
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') { notify('当前环境不支持复制图片，请使用单张下载。'); return false; }
    try {
      const canvas = renderTile(image.element, tile, { ...output, format: 'png' });
      const blobPromise = canvasBlob(canvas, { ...output, format: 'png' });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
      canvas.width = canvas.height = 1;
      notify(`切块 ${tile.number} 已复制为 PNG`);
      return true;
    } catch { notify('复制图片未获浏览器许可，请使用下载按钮。'); return false; }
  };
  const downloadAll = async () => {
    if (!image || busy || calculated.error) return;
    setBusy(true); setProgress(0);
    try {
      const blob = await exportZip(image.element, calculated.tiles, output, setProgress);
      const name = `${safeFilename(output.filename)}_${calculated.x.length + 1}×${calculated.y.length + 1}.zip`;
      if (archiveUrl.current) URL.revokeObjectURL(archiveUrl.current);
      archiveUrl.current = URL.createObjectURL(blob);
      setArchive({ url: archiveUrl.current, name });
      download(blob, name);
      notify(`${calculated.tiles.length} 张切图已打包，可再次点击保存 ZIP`);
    } catch (failure) { notify((failure as Error).message); }
    finally { setBusy(false); }
  };
  const dragFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files');

  return <div className="app-shell" onDragEnter={event => { if (!busy && dragFiles(event)) { event.preventDefault(); dragCounter.current++; setDragging(true); } }} onDragLeave={event => { if (dragFiles(event)) { dragCounter.current--; if (dragCounter.current <= 0) setDragging(false); } }} onDragOver={event => { if (dragFiles(event)) event.preventDefault(); }} onDrop={event => {
    event.preventDefault(); dragCounter.current = 0; setDragging(false);
    const file = event.dataTransfer.files[0]; if (file && !busy) void loadFile(file);
  }}>
    <header className="site-header"><div className="header-inner"><a href="#" className="brand" aria-label="splitWhere 首页"><span className="brand-mark"><i /><i /><i /><i /></span><span>splitWhere<span className="brand-dot">.</span></span></a><span className="header-divider" /><span className="header-subtitle">本地图片切割工具</span><div className="header-right"><span className="local-status"><span className="status-dot" />离线可用</span><button className="help-button" onClick={() => setHelpOpen(true)}><CircleHelp size={16} /><span>使用帮助</span></button></div></div></header>
    <main>
      <div className="page-intro"><div><h1>一张图片，<span>无限可能。</span></h1><p>自由切割，恰到好处。让每一块画面都有自己的精彩。</p></div><div className="privacy-label"><ShieldCheck size={18} /><div><strong>你的图片，只属于你</strong><span>无需上传 · 无水印 · 完全免费</span></div></div></div>
      <div className="workflow"><span className="current"><span>1</span>导入图片</span><ChevronRight size={14} /><span className={image ? 'current' : ''}><span>2</span>调整切割</span><ChevronRight size={14} /><span><span>3</span>下载切图</span></div>
      <div className="workspace"><div className="main-column"><Preview image={image} tiles={calculated.tiles} xCuts={calculated.x} yCuts={calculated.y} setCuts={(axis, cuts) => setCustomCuts({ x: calculated.x, y: calculated.y, [axis]: cuts })} choose={() => fileInput.current?.click()} remove={remove} sample={loadSample} resetCuts={() => setCustomCuts(null)} error={error ?? calculated.error} loading={loading} disabled={busy || loading} />
        <div className="workspace-note"><LockKeyhole size={13} /><span>所有处理都在浏览器内完成，断网也能继续创作。</span><span className="shortcut"><kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd><kbd>V</kbd>粘贴图片</span></div>
        <Results image={image} tiles={calculated.tiles} settings={output} downloadOne={downloadOne} copyOne={copyOne} downloadAll={downloadAll} busy={busy} progress={progress} valid={!calculated.error} archive={archive} />
      </div><Settings layout={layout} setLayout={updateLayout} output={output} setOutput={setOutput} reset={reset} disabled={busy || loading} /></div>
      <div className="bottom-note"><Scissors size={14} /><span>九宫格分享、无缝轮播、长图分页、素材切片——随你发挥。</span></div>
    </main>
    <footer><span>splitWhere<span className="brand-dot">.</span> <span className="footer-tagline">小工具，大创意。</span></span><span><ShieldCheck size={12} />本地处理，安心使用</span><a href="https://www.splitimg.com/zh" target="_blank" rel="noreferrer">参考 SplitImg ↗</a></footer>
    <input className="visually-hidden" type="file" ref={fileInput} accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif" aria-label="选择本地图片" onChange={event => { const file = event.target.files?.[0]; if (file) void loadFile(file); event.target.value = ''; }} />
    {dragging && <div className="drop-overlay"><div><Upload size={44} /><h2>松手，开始切图</h2><p>图片将留在你的设备上</p></div></div>}
    {toast && <div className="toast" role="status"><Check size={17} /><span>{toast}</span><button aria-label="关闭提示" onClick={() => setToast(null)}><X size={14} /></button></div>}
    {helpOpen && <div className="modal-backdrop" onClick={() => setHelpOpen(false)}><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={event => event.stopPropagation()}><button className="icon-button close-modal" autoFocus aria-label="关闭帮助" onClick={() => setHelpOpen(false)}><X size={19} /></button><span className="modal-icon"><Scissors size={24} /></span><h2 id="help-title">三步，轻松切好每一张</h2><ol><li><strong>导入图片</strong><p>点击选择、拖入文件，或用 ⌘ / Ctrl + V 粘贴图片。也可以用示例图体验。</p></li><li><strong>调整切割</strong><p>选择预设布局，自定义行列，或按像素切割。拖动粉色线微调；选中切割线后可用方向键逐像素调整，Shift 加速。</p></li><li><strong>下载切图</strong><p>结果实时预览，支持单张下载、复制为 PNG，或全部打包 ZIP。原图不受影响。</p></li></ol><div className="help-footnote">动图仅导出读取时的静态画面。最多 400 块；每张输出最多 3200 万像素。文件不会上传，也不会自动保存，关闭页面前请下载结果。</div><button className="primary-button" onClick={() => setHelpOpen(false)}>开始创作<ChevronRight size={16} /></button></section></div>}
  </div>;
}

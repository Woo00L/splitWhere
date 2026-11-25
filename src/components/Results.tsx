import { Check, Copy, Download, Image, LoaderCircle, PackageOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Tile } from '../core/split';
import { renderTile, tileDimensions, type ExportSettings } from '../core/render';
import type { LoadedImage } from './Preview';

type Props = {
  image: LoadedImage | null; tiles: Tile[]; settings: ExportSettings;
  downloadOne: (tile: Tile) => Promise<void>; copyOne: (tile: Tile) => Promise<boolean>;
  downloadAll: () => Promise<void>; busy: boolean; progress: number; valid: boolean;
  archive: { url: string; name: string } | null;
};

export default function Results({ image, tiles, settings, downloadOne, copyOne, downloadAll, busy, progress, valid, archive }: Props) {
  const [previews, setPreviews] = useState<{ number: number; url: string }[]>([]);
  const [generating, setGenerating] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    setGenerating(true);
    setPreviewError(null);
    const timer = setTimeout(async () => {
      if (!image || !valid) { setPreviews([]); setGenerating(false); return; }
      try {
        const next: { number: number; url: string }[] = [];
        for (let i = 0; i < tiles.length; i++) {
          if (cancelled) return;
          const canvas = renderTile(image.element, tiles[i], settings, true);
          next.push({ number: tiles[i].number, url: canvas.toDataURL('image/png') });
          canvas.width = canvas.height = 1;
          if (i % 12 === 0) await new Promise(resolve => setTimeout(resolve, 0));
        }
        if (!cancelled) setPreviews(next);
      } catch (error) {
        if (!cancelled) { setPreviews([]); setPreviewError(error instanceof Error ? error.message : '预览生成失败'); }
      } finally { if (!cancelled) setGenerating(false); }
    }, 120);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [image, tiles, settings, valid]);

  const ready = Boolean(image && valid && !generating && !previewError && previews.length === tiles.length);
  return <section className="results-panel" aria-label="切图结果">
    <div className="results-heading"><div><h2>切图结果 {image && <span className="count-badge">{tiles.length}</span>}</h2><p>{image ? '预览最终效果，点击下载单张或打包带走。' : '导入图片后，你的切图会出现在这里。'}</p></div><button className="primary-button export-button" disabled={!ready || busy} onClick={downloadAll}>{busy ? <LoaderCircle className="spin" size={17} /> : <Download size={17} />}{busy ? `正在打包 ${progress} / ${tiles.length}` : `下载全部${image ? ` ${tiles.length} 张` : ''}`}<span className="zip-label">ZIP</span></button></div>
    {archive && <a className="archive-link" href={archive.url} download={archive.name}><Check size={14} />ZIP 已生成 · 点击保存<Download size={13} /></a>}
    {!image ? <div className="results-empty"><PackageOpen size={30} strokeWidth={1.2} /><span>选好图片，剩下的交给我们</span></div> : <>
      {previewError && <div className="error-message" role="alert">{previewError}</div>}
      {!valid ? <div className="results-empty"><Image size={26} /><span>请先调整切割设置</span></div> : generating ? <div className="results-empty"><LoaderCircle className="spin" size={25} /><span>正在生成预览…</span></div> : <div className="result-grid">{tiles.map((tile, index) => {
        const size = tileDimensions(tile, settings);
        return <article className="result-tile" key={`${tile.row}-${tile.col}`}><div className="result-image checkerboard"><img src={previews[index]?.url} alt={`切块 ${tile.number}`} /><span className="result-number">{String(tile.number).padStart(2, '0')}</span><div className="tile-actions"><button aria-label={`复制切块 ${tile.number}`} title="复制为 PNG" disabled={busy} onClick={async () => { if (await copyOne(tile)) { setCopied(tile.number); setTimeout(() => setCopied(null), 1800); } }}>{copied === tile.number ? <Check size={15} /> : <Copy size={15} />}</button><button aria-label={`下载切块 ${tile.number}`} title="下载单张" disabled={busy} onClick={() => downloadOne(tile)}><Download size={15} /></button></div></div><div className="result-caption"><span>切块 {String(tile.number).padStart(2, '0')}</span><span>{size.width} × {size.height}</span></div></article>;
      })}</div>}
    </>}
  </section>;
}

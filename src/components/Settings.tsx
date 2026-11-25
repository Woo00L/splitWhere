import { ChevronDown, Grid2X2, Ruler, RotateCcw } from 'lucide-react';
import { GridIcon, Segments, Stepper, Switch } from './Controls';
import type { ExportSettings } from '../core/render';

export type LayoutSettings = { mode: 'grid' | 'pixel'; cols: number; rows: number; pixelWidth: number; pixelHeight: number; reverse: boolean };
export const defaultLayout: LayoutSettings = { mode: 'grid', cols: 3, rows: 3, pixelWidth: 800, pixelHeight: 800, reverse: false };
const presets = [[2, 1], [1, 2], [3, 1], [1, 3], [2, 2], [3, 2], [3, 3], [4, 4]];
const ratios = [{ label: '原始', value: null }, { label: '1:1', value: 1 }, { label: '4:5', value: 4 / 5 }, { label: '3:4', value: 3 / 4 }, { label: '16:9', value: 16 / 9 }, { label: '9:16', value: 9 / 16 }];

type Props = {
  layout: LayoutSettings; setLayout: (v: LayoutSettings) => void;
  output: ExportSettings; setOutput: (v: ExportSettings) => void;
  reset: () => void; disabled: boolean;
};

export default function Settings({ layout, setLayout, output, setOutput, reset, disabled }: Props) {
  const changeLayout = (v: Partial<LayoutSettings>) => setLayout({ ...layout, ...v });
  const changeOutput = (v: Partial<ExportSettings>) => setOutput({ ...output, ...v });
  return <aside className="settings-panel" aria-label="切割设置">
    <div className="panel-heading"><h2><Grid2X2 size={17} />切割设置</h2><button className="text-button" disabled={disabled} onClick={reset} title="恢复默认设置"><RotateCcw size={13} />重置</button></div>
    <fieldset disabled={disabled} className="settings-fields">
      <section className="settings-section">
        <div className="section-label"><span>选择布局</span><span className="quiet">列 × 行</span></div>
        <div className="presets">{presets.map(([cols, rows]) => <button type="button" aria-label={`${cols} 列 ${rows} 行`} aria-pressed={layout.mode === 'grid' && layout.cols === cols && layout.rows === rows} key={`${cols}-${rows}`} className={`preset ${layout.mode === 'grid' && layout.cols === cols && layout.rows === rows ? 'selected' : ''}`} onClick={() => changeLayout({ mode: 'grid', cols, rows })}>
          <GridIcon cols={cols} rows={rows} /><span>{cols} × {rows}</span>
        </button>)}</div>
        <Segments label="切割方式" value={layout.mode} onChange={mode => changeLayout({ mode })} options={[{ value: 'grid', label: <><Grid2X2 size={13} />按块数</> }, { value: 'pixel', label: <><Ruler size={13} />按像素</> }]} />
        {layout.mode === 'grid' ? <div className="double-fields"><Stepper label="列数" value={layout.cols} onChange={cols => changeLayout({ cols })} /><Stepper label="行数" value={layout.rows} onChange={rows => changeLayout({ rows })} /></div> : <>
          <div className="double-fields pixel-fields"><label>每块宽度<div className="unit-input"><input aria-label="每块像素宽度" type="number" min="1" max="32768" value={layout.pixelWidth} onChange={e => changeLayout({ pixelWidth: Number(e.target.value) })} /><span>px</span></div></label><label>每块高度<div className="unit-input"><input aria-label="每块像素高度" type="number" min="1" max="32768" value={layout.pixelHeight} onChange={e => changeLayout({ pixelHeight: Number(e.target.value) })} /><span>px</span></div></label></div>
          <p className="field-help">边缘不足设定尺寸的部分会单独保留。</p>
        </>}
      </section>
      <section className="settings-section">
        <div className="switch-row"><div><span>九宫格发布顺序</span><p className="field-help">从右下到左上编号，按序发布。</p></div><Switch label="九宫格发布顺序" checked={layout.reverse} onChange={reverse => changeLayout({ reverse })} /></div>
        <div className="section-label shape-label"><span>切块形状</span></div>
        <div className="ratio-options" role="group" aria-label="切块形状">{ratios.map(ratio => <button type="button" key={ratio.label} aria-pressed={output.ratio === ratio.value} className={output.ratio === ratio.value ? 'selected' : ''} onClick={() => changeOutput({ ratio: ratio.value })}>{ratio.label}</button>)}</div>
        <p className="field-help">{output.ratio ? '每块按所选比例居中裁剪，预览即最终效果。' : '保留每块完整画面，不额外裁剪。'}</p>
      </section>
      <details className="settings-details">
        <summary><span>边框与圆角</span><span className="summary-meta">{output.border || output.radius ? '已调整' : '无'}<ChevronDown size={14} /></span></summary>
        <div className="details-content">
          <label className="range-label">边框宽度<span>{output.border} px</span><input aria-label="边框宽度" type="range" min="0" max="50" value={output.border} onChange={e => changeOutput({ border: Number(e.target.value) })} /></label>
          <label className="color-label">边框 / JPG 底色<div><span>{output.borderColor.toUpperCase()}</span><input type="color" aria-label="边框颜色" value={output.borderColor} onChange={e => changeOutput({ borderColor: e.target.value })} /></div></label>
          <label className="range-label">圆角<span>{output.radius}%</span><input aria-label="圆角" type="range" min="0" max="50" value={output.radius} onChange={e => changeOutput({ radius: Number(e.target.value) })} /></label>
        </div>
      </details>
      <details className="settings-details" open>
        <summary><span>输出设置</span><span className="summary-meta">{output.format === 'jpeg' ? 'JPG' : output.format.toUpperCase()} · {output.targetWidth ?? '原图'}<ChevronDown size={14} /></span></summary>
        <div className="details-content">
          <label className="field-title">图片格式</label>
          <Segments label="图片格式" value={output.format} options={[{ value: 'png', label: 'PNG' }, { value: 'jpeg', label: 'JPG' }, { value: 'webp', label: 'WebP' }]} onChange={format => changeOutput({ format })} />
          {output.format !== 'png' && <label className="range-label">画质<span>{output.quality}%</span><input aria-label="画质" type="range" min="10" max="100" value={output.quality} onChange={e => changeOutput({ quality: Number(e.target.value) })} /></label>}
          <label className="field-title">每块宽度</label>
          <div className="width-options" role="group" aria-label="每块输出宽度">{[null, 1080, 1440, 2048].map(width => <button type="button" key={width ?? 'original'} className={output.targetWidth === width ? 'selected' : ''} aria-pressed={output.targetWidth === width} onClick={() => changeOutput({ targetWidth: width })}>{width ?? '原图'}</button>)}</div>
          <label className="filename-label">文件名前缀<input value={output.filename} aria-label="文件名前缀" maxLength={100} onChange={e => changeOutput({ filename: e.target.value })} placeholder="图片切割" /></label>
          <p className="field-help">{output.format === 'png' ? 'PNG 无损导出，支持透明背景。' : output.format === 'jpeg' ? 'JPG 使用所选底色填充透明区域。' : 'WebP 兼顾体积与画质，支持透明背景。'}</p>
        </div>
      </details>
    </fieldset>
  </aside>;
}

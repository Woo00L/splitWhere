import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { unzipSync } from 'fflate';
import { canvasBlob, defaultExport, exportZip, renderTile } from './render.ts';
import { equalCuts, makeTiles } from './split.ts';

// 使用真实的 Canvas 绘制和图像编码，只适配浏览器创建画布与 Blob 的接口。
Object.defineProperty(globalThis, 'document', { value: {
  createElement: (name: string) => {
    assert.equal(name, 'canvas');
    const canvas = createCanvas(1, 1);
    Object.defineProperty(canvas, 'toBlob', { value: async (callback: (blob: Blob) => void, mime: string, quality: number) => {
      const format = mime.slice('image/'.length) as 'png' | 'jpeg' | 'webp';
      const bytes = format === 'png' ? await canvas.encode('png') : await canvas.encode(format, Math.round(quality * 100));
      callback(new Blob([new Uint8Array(bytes)], { type: mime }));
    } });
    return canvas;
  },
} });

async function sourceImage() {
  const canvas = createCanvas(101, 79);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 51, 79);
  ctx.fillStyle = '#0000ff'; ctx.fillRect(51, 0, 50, 79);
  return await loadImage(canvas.toBuffer('image/png')) as unknown as HTMLImageElement;
}

test('九宫格 ZIP 包含九张可解码 PNG，完整保留原图面积', async () => {
  const source = await sourceImage();
  const tiles = makeTiles(101, 79, equalCuts(101, 3), equalCuts(79, 3));
  const progress: number[] = [];
  const zip = await exportZip(source, tiles, { ...defaultExport, filename: '测试图片' }, done => progress.push(done));
  const files = unzipSync(new Uint8Array(await zip.arrayBuffer()));
  assert.equal(Object.keys(files).length, 9);
  assert.deepEqual(progress, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  let area = 0;
  for (const [name, bytes] of Object.entries(files)) {
    assert.match(name, /^测试图片_0[1-9]\.png$/);
    assert.deepEqual([...bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    const decoded = await loadImage(Buffer.from(bytes));
    area += decoded.width * decoded.height;
  }
  assert.equal(area, 101 * 79);
});

test('PNG 圆角保留透明度，边框、缩放和裁剪尺寸正确', async () => {
  const source = await sourceImage();
  const tile = makeTiles(101, 79, [], [])[0];
  const options = { ...defaultExport, ratio: 1, targetWidth: 100, border: 10, radius: 25, borderColor: '#00ff00' };
  const result = renderTile(source, tile, options);
  assert.equal(result.width, 120);
  assert.equal(result.height, 120);
  const ctx = result.getContext('2d')!;
  assert.equal(ctx.getImageData(0, 0, 1, 1).data[3], 0);
  assert.deepEqual([...ctx.getImageData(60, 5, 1, 1).data], [0, 255, 0, 255]);
  assert.deepEqual([...ctx.getImageData(25, 60, 1, 1).data], [255, 0, 0, 255]);
  const blob = await canvasBlob(result, options);
  const decoded = await loadImage(Buffer.from(await blob.arrayBuffer()));
  assert.equal(decoded.width, 120);
});

test('JPG 和 WebP 文件头与指定格式一致，图片可以正常解码', async () => {
  const source = await sourceImage();
  const tile = makeTiles(101, 79, [], [])[0];
  for (const format of ['jpeg', 'webp'] as const) {
    const options = { ...defaultExport, format, radius: 25, borderColor: '#00ff00' };
    const result = renderTile(source, tile, options);
    if (format === 'jpeg') assert.deepEqual([...result.getContext('2d')!.getImageData(0, 0, 1, 1).data], [0, 255, 0, 255]);
    const blob = await canvasBlob(result, options);
    const bytes = Buffer.from(await blob.arrayBuffer());
    assert.equal(blob.type, `image/${format}`);
    if (format === 'jpeg') assert.deepEqual([...bytes.slice(0, 2)], [255, 216]);
    else assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    const decoded = await loadImage(bytes);
    assert.equal(decoded.width, 101);
    assert.equal(decoded.height, 79);
  }
});

test('拒绝异常大的单块输出，防止画布内存失控', async () => {
  const source = await sourceImage();
  const tile = makeTiles(101, 79, [], [])[0];
  assert.throws(() => renderTile(source, tile, { ...defaultExport, targetWidth: 20000 }), /尺寸过大/);
});

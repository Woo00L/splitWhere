import { createCanvas } from '@napi-rs/canvas';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const output = fileURLToPath(new URL('../build/', import.meta.url));
await mkdir(output, { recursive: true });

function icon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const unit = size / 1024;
  ctx.scale(unit, unit);
  ctx.fillStyle = '#201923';
  ctx.beginPath(); ctx.roundRect(0, 0, 1024, 1024, 220); ctx.fill();
  const colors = ['#ed54a7', '#f4add3', '#f4add3', '#ed54a7'];
  colors.forEach((color, index) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(208 + (index % 2) * 324, 208 + Math.floor(index / 2) * 324, 284, 284, 48);
    ctx.fill();
  });
  return canvas.toBuffer('image/png');
}

await writeFile(join(output, 'icon.png'), icon(1024));
// ICNS 的现代图标条目直接保存 PNG，覆盖常见尺寸及 Retina 显示。
const icnsEntries = [['icp4', 16], ['icp5', 32], ['icp6', 64], ['ic07', 128], ['ic08', 256], ['ic09', 512], ['ic10', 1024]].map(([type, size]) => {
  const png = icon(size);
  const header = Buffer.alloc(8);
  header.write(type, 0); header.writeUInt32BE(8 + png.length, 4);
  return Buffer.concat([header, png]);
});
const icnsHeader = Buffer.alloc(8);
icnsHeader.write('icns', 0); icnsHeader.writeUInt32BE(8 + icnsEntries.reduce((sum, entry) => sum + entry.length, 0), 4);
await writeFile(join(output, 'icon.icns'), Buffer.concat([icnsHeader, ...icnsEntries]));

const sizes = [16, 32, 48, 64, 128, 256];
const pngs = sizes.map(icon);
const icoHeader = Buffer.alloc(6 + sizes.length * 16);
icoHeader.writeUInt16LE(1, 2); icoHeader.writeUInt16LE(sizes.length, 4);
let offset = icoHeader.length;
sizes.forEach((size, index) => {
  const entry = 6 + index * 16;
  icoHeader[entry] = size === 256 ? 0 : size;
  icoHeader[entry + 1] = size === 256 ? 0 : size;
  icoHeader.writeUInt16LE(1, entry + 4); icoHeader.writeUInt16LE(32, entry + 6);
  icoHeader.writeUInt32LE(pngs[index].length, entry + 8); icoHeader.writeUInt32LE(offset, entry + 12);
  offset += pngs[index].length;
});
await writeFile(join(output, 'icon.ico'), Buffer.concat([icoHeader, ...pngs]));
console.log('已生成 macOS、Windows 和桌面窗口图标');

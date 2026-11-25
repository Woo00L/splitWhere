import { test } from 'node:test';
import assert from 'node:assert/strict';
import { equalCuts, pixelCuts, makeTiles, cropToRatio, outputDimensions, moveCut, safeFilename } from './split.ts';

test('奇数尺寸切为九宫格时覆盖全部像素，切块无重叠', () => {
  const tiles = makeTiles(1001, 799, equalCuts(1001, 3), equalCuts(799, 3));
  assert.equal(tiles.length, 9);
  assert.equal(tiles.reduce((sum, t) => sum + t.width * t.height, 0), 1001 * 799);
  assert.equal(tiles[0].x, 0);
  assert.equal(tiles[2].x + tiles[2].width, 1001);
  assert.equal(tiles[8].y + tiles[8].height, 799);
  assert.equal(tiles[0].x + tiles[0].width, tiles[1].x);
});

test('按像素切割保留末尾不满一块的图片', () => {
  const tiles = makeTiles(1000, 200, pixelCuts(1000, 300), []);
  assert.deepEqual(tiles.map(t => t.width), [300, 300, 300, 100]);
});

test('反序编号用于发布顺序，不改变图片位置', () => {
  const tiles = makeTiles(900, 600, equalCuts(900, 3), equalCuts(600, 2), true);
  assert.deepEqual(tiles.map(t => t.number), [6, 5, 4, 3, 2, 1]);
  assert.equal(tiles[0].x, 0);
});

test('裁剪为目标比例时使用中心区域', () => {
  assert.deepEqual(cropToRatio({ x: 0, y: 0, width: 900, height: 600 }, 1), { x: 150, y: 0, width: 600, height: 600 });
  const portrait = cropToRatio({ x: 10, y: 20, width: 400, height: 800 }, 4 / 5);
  assert.deepEqual(portrait, { x: 10, y: 170, width: 400, height: 500 });
});

test('拖动切割线不能越过相邻线，并至少保留一个像素', () => {
  const cuts = [0.25, 0.5, 0.75];
  assert.equal(moveCut(cuts, 1, 0.99, 100)[1], 0.74);
  assert.equal(moveCut(cuts, 1, -1, 100)[1], 0.26);
  assert.deepEqual(cuts, [0.25, 0.5, 0.75]);
});

test('输出缩放保持宽高比，边框计入输出尺寸', () => {
  assert.deepEqual(outputDimensions({ width: 400, height: 500 }, 1080, 10), { width: 1100, height: 1370, imageWidth: 1080, imageHeight: 1350 });
});

test('拒绝零尺寸、过密切割和超出数量限制的输入', () => {
  assert.throws(() => equalCuts(0, 3));
  assert.throws(() => equalCuts(2, 3));
  assert.throws(() => pixelCuts(1000, 0));
  assert.throws(() => makeTiles(100, 100, equalCuts(100, 21), equalCuts(100, 21)));
});

test('文件名保留中文并移除路径字符', () => {
  assert.equal(safeFilename(' 我的/旅行:照片.png '), '我的_旅行_照片');
  assert.equal(safeFilename(''), '图片切割');
});

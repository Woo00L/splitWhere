import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultView, previewSize, zoomAtCenter, edgeScrollSpeed } from './viewport.ts';

test('1080×12504 长图默认按宽度显示，超出区域通过画布滚动浏览', () => {
  const image = { width: 1080, height: 12504 };
  assert.equal(defaultView(image), 'width');
  const size = previewSize(image, { width: 800, height: 420 }, defaultView(image));
  assert.equal(size.width, 752);
  assert.ok(size.height > 8000);
});

test('全图模式可以完整查看，100% 模式保持一个原图像素对应一个 CSS 像素', () => {
  const image = { width: 1080, height: 12504 };
  const viewport = { width: 800, height: 420 };
  const fit = previewSize(image, viewport, 'fit');
  assert.ok(fit.height <= 372);
  assert.ok(fit.width < 40);
  assert.deepEqual(previewSize(image, viewport, 1), { width: 1080, height: 12504, scale: 1 });
});

test('普通横图默认完整展示，不被宽度模式裁去高度', () => {
  const image = { width: 2400, height: 800 };
  assert.equal(defaultView(image), 'fit');
  const size = previewSize(image, { width: 800, height: 420 }, 'fit');
  assert.equal(size.width, 752);
  assert.ok(size.height < 372);
});

test('缩放后保持当前正在查看的位置，而不是跳回长图顶部', () => {
  const scroll = zoomAtCenter({ left: 0, top: 3000 }, { width: 800, height: 420 }, { width: 752, height: 8707 }, { width: 1080, height: 12504 });
  assert.ok(scroll.top > 4300 && scroll.top < 4600);
  assert.equal(scroll.left, 164);
});

test('拖线接近画布边缘时自动滚动，中部不滚动', () => {
  assert.equal(edgeScrollSpeed(200, 0, 420), 0);
  assert.ok(edgeScrollSpeed(410, 0, 420) > 0);
  assert.ok(edgeScrollSpeed(10, 0, 420) < 0);
  assert.ok(Math.abs(edgeScrollSpeed(600, 0, 420)) <= 16);
});

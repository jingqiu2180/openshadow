// @ts-nocheck
// vitest setup: DOM polyfills for TiPTap/prosemirror tests
// 注: 部分测试在 node 环境跑（没有 document），需要用 typeof 守卫

if (typeof document !== "undefined") {
  // elementFromPoint — required by prosemirror-view placeholder tracking
  if (!document.elementFromPoint) {
    (document as any).elementFromPoint = () => null;
  }
}

if (typeof Range !== "undefined") {
  // Range.getClientRects — required by prosemirror-view
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = () => ({
      length: 0,
      item: () => null,
      [Symbol.iterator]: function* () {},
    }) as any;
  }

  // Range.getBoundingClientRect
  if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = () => ({
      x: 0, y: 0, width: 0, height: 0,
      top: 0, right: 0, bottom: 0, left: 0,
      toJSON: () => ({}),
    }) as any;
  }
}


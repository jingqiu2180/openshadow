/**
 * 回归测试：门面 resizeModelImageInput 对 Pi SDK resizeImage 的签名适配。
 * 0.80.3 起上游 resizeImage 签名 (inputBytes: Uint8Array, mimeType, options?)，
 * 门面负责 base64 解码 + 拆参；消费侧契约不变。
 */
import { describe, expect, it } from "vitest";
import { resizeModelImageInput, formatModelImageDimensionNote } from "../lib/pi-sdk/index.ts";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAa0lEQVR42g3JQQEAMAgDMZwgpVIqhXOCFKTUypZvqoouVLiYYosrUlQ13ahxM80216R/iBYSFiNWnIh+mDYyNmPWnIl/DD1o8DDDDjdkfiy9aPEyyy63ZH8cfejwMcced+R+hA4KDhM2XEh4nZNXkTSLioEAAAAASUVORK5CYII=";

describe("pi-sdk resizeModelImageInput signature adapter", () => {
  it("resizes an oversized image and returns the ResizedImage contract", async () => {
    const result = await resizeModelImageInput(
      { type: "image", data: TINY_PNG_BASE64, mimeType: "image/png" },
      { maxWidth: 4, maxHeight: 4 },
    );
    expect(result).not.toBeNull();
    expect(typeof result.data).toBe("string");
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.mimeType).toMatch(/^image\//);
    expect(result.originalWidth).toBe(8);
    expect(result.originalHeight).toBe(8);
    expect(result.width).toBeLessThanOrEqual(4);
    expect(result.height).toBeLessThanOrEqual(4);
    expect(result.wasResized).toBe(true);
    expect(typeof formatModelImageDimensionNote(result)).toBe("string");
  });

  it("passes through an image already within bounds without resizing", async () => {
    const result = await resizeModelImageInput(
      { type: "image", data: TINY_PNG_BASE64, mimeType: "image/png" },
      { maxWidth: 64, maxHeight: 64 },
    );
    expect(result).not.toBeNull();
    expect(result.wasResized).toBe(false);
    expect(result.originalWidth).toBe(8);
    expect(result.originalHeight).toBe(8);
    expect(formatModelImageDimensionNote(result)).toBeUndefined();
  });
});

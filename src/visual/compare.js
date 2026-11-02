// Perceptual image diff — no external deps. Uses a YIQ colour-distance metric
// (the same approach as the pixelmatch library) so small anti-aliasing noise
// doesn't trip the comparison, and writes a red-highlighted diff image.
import { decodePNG, encodePNG } from "./png.js";

// Max possible YIQ distance, used to scale the threshold (from pixelmatch).
const MAX_DELTA = 35215;

function yiqDelta(a, i, b, j) {
  // blend over white so alpha differences count sensibly
  const blend = (buf, k) => {
    const al = buf[k + 3] / 255;
    return [255 + (buf[k] - 255) * al, 255 + (buf[k + 1] - 255) * al, 255 + (buf[k + 2] - 255) * al];
  };
  const [r1, g1, b1] = blend(a, i);
  const [r2, g2, b2] = blend(b, j);
  const y = 0.29889531 * (r1 - r2) + 0.58662247 * (g1 - g2) + 0.11448223 * (b1 - b2);
  const q = 0.59597799 * (r1 - r2) - 0.2741761 * (g1 - g2) - 0.32180189 * (b1 - b2);
  const i2 = 0.21147017 * (r1 - r2) - 0.52261711 * (g1 - g2) + 0.31114694 * (b1 - b2);
  return 0.5053 * y * y + 0.299 * i2 * i2 + 0.1957 * q * q;
}

/**
 * @param {Buffer} baselinePng
 * @param {Buffer} currentPng
 * @param {{pixelThreshold?:number}} [opts] 0..1, lower = stricter (default 0.1)
 * @returns {{width,height,diffPixels,totalPixels,ratio,sizeMismatch,diffPng:Buffer}}
 */
export function compare(baselinePng, currentPng, opts = {}) {
  const a = decodePNG(baselinePng);
  const b = decodePNG(currentPng);

  if (a.width !== b.width || a.height !== b.height) {
    return {
      width: b.width,
      height: b.height,
      diffPixels: b.width * b.height,
      totalPixels: b.width * b.height,
      ratio: 1,
      sizeMismatch: true,
      diffPng: currentPng,
    };
  }

  const { width, height } = a;
  const threshold = (opts.pixelThreshold ?? 0.1) * MAX_DELTA;
  const diff = new Uint8Array(width * height * 4);
  let diffPixels = 0;

  for (let p = 0; p < width * height; p++) {
    const k = p * 4;
    const delta = yiqDelta(a.data, k, b.data, k);
    if (delta > threshold) {
      diffPixels++;
      diff[k] = 255; diff[k + 1] = 49; diff[k + 2] = 49; diff[k + 3] = 255; // red
    } else {
      // faded original for context
      const v = (a.data[k] * 0.3 + a.data[k + 1] * 0.59 + a.data[k + 2] * 0.11);
      const g = Math.round(255 - (255 - v) * 0.15);
      diff[k] = g; diff[k + 1] = g; diff[k + 2] = g; diff[k + 3] = 255;
    }
  }

  const totalPixels = width * height;
  return {
    width,
    height,
    diffPixels,
    totalPixels,
    ratio: diffPixels / totalPixels,
    sizeMismatch: false,
    diffPng: encodePNG(width, height, diff),
  };
}

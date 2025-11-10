import * as THREE from "./vendor/three/build/three.module.js";
import { TextGeometry } from "./vendor/three/examples/jsm/geometries/TextGeometry.js";

export const PLATE_WIDTH_MM = 76.5;
export const PLATE_HEIGHT_MM = 22.0;
export const PLATE_THICKNESS_MM = 1.0;
export const TEXT_DEPTH_MM = 1.0;
export const TEXT_EMBED_MM = 0.2;
export const HORIZONTAL_PADDING_MM = 2.0;
export const VERTICAL_PADDING_MM = 5.0;
export const USABLE_WIDTH_MM = PLATE_WIDTH_MM - HORIZONTAL_PADDING_MM * 2;
export const USABLE_HEIGHT_MM = PLATE_HEIGHT_MM - VERTICAL_PADDING_MM * 2;
export const LINE_SPACING_MM = 2.0;

export const DEFAULT_FONT_SIZE_TIERS = {
  1: 9.0,
  2: 6.5,
  3: 5.0,
};

export const BASELINE_PRESETS = {
  1: [0],
  2: [4.5, -4.5],
  3: [6.5, 0, -6.5],
};

const measureCache = new Map();

function measureLineWidth(text, font, fontSize) {
  if (!text) return 0;
  const cacheKey = `${font.data.familyName}|${font.data.fullName}|${fontSize}|${text}`;
  if (measureCache.has(cacheKey)) {
    return measureCache.get(cacheKey);
  }

  const geometry = new TextGeometry(text, {
    font,
    size: fontSize,
    depth: 0.01,
    curveSegments: 4,
    bevelEnabled: false,
  });
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  const width = bbox ? bbox.max.x - bbox.min.x : 0;
  geometry.dispose();

  measureCache.set(cacheKey, width);
  return width;
}

/**
 * Compute layout for the provided explicit lines.
 * @param {object} params
 * @param {string[]} params.lines
 * @param {THREE.Font} params.font
 */
export function computeLayout({ lines, font, fontSizes = DEFAULT_FONT_SIZE_TIERS }) {
  if (!font) {
    return {
      fits: false,
      lines: [],
      widths: [],
      fontSize: DEFAULT_FONT_SIZE_TIERS[1],
      lineCount: 0,
      overflowIndex: null,
    };
  }

  const sanitized = (lines || []).filter((line) => !!line).slice(0, 3);
  const lineCount = sanitized.length;
  if (!lineCount) {
    return {
      fits: false,
      lines: [],
      widths: [],
      fontSize: DEFAULT_FONT_SIZE_TIERS[1],
      lineCount: 0,
      overflowIndex: null,
      baselineOffsets: [],
    };
  }

  const tier = Math.min(lineCount, 3);
  const fontSize =
    fontSizes[tier] ??
    DEFAULT_FONT_SIZE_TIERS[tier] ??
    DEFAULT_FONT_SIZE_TIERS[3];
  const widths = sanitized.map((line) => measureLineWidth(line, font, fontSize));
  const overflowIndex = widths.findIndex((width) => width > USABLE_WIDTH_MM);
  const fits = overflowIndex === -1;

  return {
    fits,
    lines: sanitized,
    widths,
    fontSize,
    lineCount,
    overflowIndex: fits ? null : overflowIndex,
    baselineOffsets: BASELINE_PRESETS[lineCount] || [],
  };
}

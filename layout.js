import { TextGeometry } from "./vendor/three/examples/jsm/geometries/TextGeometry.js";

export const layoutDefaults = {
  plateWidthMm: 76.5,
  plateHeightMm: 22.0,
  plateThicknessMm: 1.0,
  textDepthMm: 1.0,
  textEmbedMm: 0.0,
  horizontalPaddingMm: 2.0,
  verticalPaddingMm: 5.0,
  lineSpacingMm: 2.0,
};

export const layoutState = { ...layoutDefaults };

export function setLayoutValue(key, value) {
  if (!(key in layoutState)) {
    throw new Error(`Unknown layout key: ${key}`);
  }
  layoutState[key] = value;
}

export function resetLayoutState() {
  Object.assign(layoutState, layoutDefaults);
  measureCache.clear();
}

export function getUsableWidth() {
  return (
    layoutState.plateWidthMm - layoutState.horizontalPaddingMm * 2
  );
}

export function getUsableHeight() {
  return (
    layoutState.plateHeightMm - layoutState.verticalPaddingMm * 2
  );
}

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

export function computeLayout({ lines, font, fontSizes = DEFAULT_FONT_SIZE_TIERS }) {
  if (!font) {
    return {
      fits: false,
      lines: [],
      widths: [],
      fontSize: fontSizes[1],
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
      fontSize: fontSizes[1],
      lineCount: 0,
      overflowIndex: null,
      baselineOffsets: [],
    };
  }

  const tier = Math.min(lineCount, 3);
  const fontSize =
    fontSizes[tier] ??
    fontSizes[Math.min(3, tier)] ??
    fontSizes[1];
  const widths = sanitized.map((line) => measureLineWidth(line, font, fontSize));
  const usableWidth = getUsableWidth();
  const overflowIndex = widths.findIndex((width) => width > usableWidth);
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

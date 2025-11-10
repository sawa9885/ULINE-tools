export const COLOR_OPTIONS = [
  { name: "Black", rgb: [0, 0, 0] },
  { name: "White", rgb: [255, 255, 255] },
];

/**
 * Convert 0-255 RGB triplet to normalized sRGB components (0-1) for exports.
 * @param {number[]} rgb
 * @returns {number[]} normalized components
 */
export function rgbToNormalized(rgb) {
  return rgb.map((component) => component / 255);
}

/**
 * Convert 0-255 RGB triplet to CSS hex string.
 * @param {number[]} rgb
 * @returns {string}
 */
export function rgbToHex(rgb) {
  return `#${rgb
    .map((component) => component.toString(16).padStart(2, "0"))
    .join("")}`;
}

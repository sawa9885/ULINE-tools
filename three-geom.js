import * as THREE from "./vendor/three/build/three.module.js";
import { TextGeometry } from "./vendor/three/examples/jsm/geometries/TextGeometry.js";
import { mergeGeometries } from "./vendor/three/examples/jsm/utils/BufferGeometryUtils.js";
import { layoutState } from "./layout.js";
import { repairGeometry } from "./repair-geometry.js";

export function buildRoundedRectPlate({
  width = layoutState.plateWidthMm,
  height = layoutState.plateHeightMm,
  radius = 1.0,
  thickness = layoutState.plateThicknessMm,
} = {}) {
  const hw = width / 2;
  const hh = height / 2;
  const shape = new THREE.Shape();

  shape.moveTo(-hw + radius, -hh);
  shape.lineTo(hw - radius, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + radius);
  shape.lineTo(hw, hh - radius);
  shape.quadraticCurveTo(hw, hh, hw - radius, hh);
  shape.lineTo(-hw + radius, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - radius);
  shape.lineTo(-hw, -hh + radius);
  shape.quadraticCurveTo(-hw, -hh, -hw + radius, -hh);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 12,
  });

  return repairGeometry(geometry);
}

function normalizeLineHeight(geometry, targetHeight) {
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  if (!bbox) return;
  const height = Math.max(1e-5, bbox.max.y - bbox.min.y);
  const scale = targetHeight / height;
  geometry.scale(1, scale, 1);
  geometry.computeBoundingBox();
}

function createLineGeometry(text, { font, fontSize, depth, baselineY }) {
  const geometry = new TextGeometry(text, {
    font,
    size: fontSize,
    height: depth,
    curveSegments: 8,
    bevelEnabled: false,
  });

  normalizeLineHeight(geometry, fontSize);

  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  const xOffset = bbox ? -0.5 * (bbox.max.x + bbox.min.x) : 0;
  const yOffset = bbox ? -0.5 * (bbox.max.y + bbox.min.y) : 0;

  const zOffset = layoutState.plateThicknessMm - layoutState.textEmbedMm;
  geometry.translate(xOffset, baselineY + yOffset, zOffset);

  geometry.computeVertexNormals();
  return geometry;
}

export function buildTextGeometry({
  lines,
  font,
  fontSize,
  depth = layoutState.textDepthMm,
  lineSpacing = layoutState.lineSpacingMm,
  baselineOffsets = null,
}) {
  if (!font || !lines || lines.length === 0) return null;

  const lineCount = lines.length;
  const effectiveSpacing = fontSize + lineSpacing;
  const useCustomOffsets =
    Array.isArray(baselineOffsets) && baselineOffsets.length === lineCount;
  const startOffset = ((lineCount - 1) * effectiveSpacing) / 2;

  const geometries = lines.map((line, index) => {
    const baselineY = useCustomOffsets
      ? baselineOffsets[index]
      : startOffset - index * effectiveSpacing;
    return createLineGeometry(line, {
      font,
      fontSize,
      depth,
      baselineY,
    });
  });

  const merged = mergeGeometries(geometries, false);
  geometries.forEach((geo) => geo.dispose());
  return repairGeometry(merged);
}

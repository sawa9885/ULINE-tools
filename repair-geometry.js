import { mergeVertices } from "./vendor/three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Attempts to weld duplicate vertices and recompute bounds to eliminate
 * non-manifold seams that appear after boolean operations or geometry merges.
 * Returns a fresh BufferGeometry instance; on failure the original geometry
 * is returned unchanged.
 */
export function repairGeometry(geometry, { tolerance = 1e-4 } = {}) {
  if (!geometry) {
    return null;
  }

  try {
    const repaired = mergeVertices(geometry, tolerance);
    geometry.dispose?.();
    repaired.computeVertexNormals();
    repaired.computeBoundingBox();
    repaired.computeBoundingSphere();
    return repaired;
  } catch (error) {
    console.error("repairGeometry failed", error);
    geometry.computeVertexNormals?.();
    geometry.computeBoundingBox?.();
    geometry.computeBoundingSphere?.();
    return geometry;
  }
}

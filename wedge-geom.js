import * as THREE from "./vendor/three/build/three.module.js";
import { repairGeometry } from "./repair-geometry.js";

export const wedgeDefaults = {
  baseLength: 20,
  height: 3.5,
  extrusionLength: 190,
};

export function buildWedgeSolid({
  baseLength = wedgeDefaults.baseLength,
  height = wedgeDefaults.height,
  extrusionLength = wedgeDefaults.extrusionLength,
} = {}) {
  const base = Math.max(baseLength, 1);
  const tall = Math.max(height, 0.5);
  const depth = Math.max(extrusionLength, 0.5);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(base, 0);
  shape.lineTo(0, tall);
  shape.lineTo(0, 0);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
  });
  geometry.center();
  geometry.computeBoundingBox();
  geometry.computeVertexNormals();
  return repairGeometry(geometry);
}

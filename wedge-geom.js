import * as THREE from "./vendor/three/build/three.module.js";
import { repairGeometry } from "./repair-geometry.js";

export const wedgeDefaults = {
  baseLength: 20,
  height: 3.5,
  tipHeight: 0.7,
  filletRadius: 1,
  extrusionLength: 190,
};

export function buildWedgeSolid({
  baseLength = wedgeDefaults.baseLength,
  height = wedgeDefaults.height,
  tipHeight = wedgeDefaults.tipHeight,
  filletRadius = wedgeDefaults.filletRadius,
  extrusionLength = wedgeDefaults.extrusionLength,
} = {}) {
  const base = Math.max(baseLength, 1);
  const tall = Math.max(height, 0.5);
  const blunt = Math.max(Math.min(tipHeight, tall), 0);
  const depth = Math.max(extrusionLength, 0.5);
  const tip = new THREE.Vector2(base, blunt);
  const top = new THREE.Vector2(0, tall);
  const hypVector = top.clone().sub(tip);
  const hypLength = hypVector.length();
  const maxFillet = Math.min(hypLength, tall);
  const fillet = Math.max(0, Math.min(filletRadius, maxFillet - 1e-4));

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(base, 0);
  shape.lineTo(tip.x, tip.y);

  if (fillet > 0) {
    const hypDirFromTip = hypVector.clone().normalize();
    const hypPoint = top
      .clone()
      .sub(hypDirFromTip.clone().multiplyScalar(fillet));
    const heightPoint = new THREE.Vector2(0, Math.max(tall - fillet, 0));
    shape.lineTo(hypPoint.x, hypPoint.y);
    shape.quadraticCurveTo(top.x, top.y, heightPoint.x, heightPoint.y);
  } else {
    shape.lineTo(top.x, top.y);
  }

  shape.lineTo(0, 0);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
  });
  geometry.center();
  geometry.rotateX(Math.PI / 2);
  geometry.rotateZ(Math.PI / 2);
  geometry.computeBoundingBox();
  const minZ = geometry.boundingBox?.min.z ?? 0;
  geometry.translate(0, 0, -minZ);
  geometry.computeBoundingBox();
  geometry.computeVertexNormals();
  return repairGeometry(geometry);
}

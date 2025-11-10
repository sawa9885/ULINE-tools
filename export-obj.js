import JSZip from "./vendor/jszip.esm.js";
import { rgbToNormalized } from "./colors.js";

function geometryToObjectSection({
  geometry,
  objectName,
  materialName,
  vertexOffset,
}) {
  if (!geometry) {
    return { lines: [], vertexOffset };
  }

  const workingGeometry = geometry.index
    ? geometry.toNonIndexed()
    : geometry.clone();
  const positionAttr = workingGeometry.getAttribute("position");
  const sectionLines = [
    `o ${objectName}`,
    `g ${objectName}`,
    `usemtl ${materialName}`,
  ];

  for (let i = 0; i < positionAttr.count; i += 1) {
    sectionLines.push(
      `v ${positionAttr.getX(i).toFixed(5)} ${positionAttr
        .getY(i)
        .toFixed(5)} ${positionAttr.getZ(i).toFixed(5)}`
    );
  }

  for (let i = 0; i < positionAttr.count; i += 3) {
    const a = vertexOffset + i + 1;
    const b = vertexOffset + i + 2;
    const c = vertexOffset + i + 3;
    sectionLines.push(`f ${a} ${b} ${c}`);
  }

  workingGeometry.dispose();

  return {
    lines: sectionLines,
    vertexOffset: vertexOffset + positionAttr.count,
  };
}

function buildObjContent({ plateGeometry, textGeometry }) {
  const lines = ["mtllib label.mtl"];
  let vertexOffset = 0;

  const plateSection = geometryToObjectSection({
    geometry: plateGeometry,
    objectName: "Plate",
    materialName: "Plate",
    vertexOffset,
  });
  lines.push(...plateSection.lines);
  vertexOffset = plateSection.vertexOffset;

  const textSection = geometryToObjectSection({
    geometry: textGeometry,
    objectName: "Text",
    materialName: "Text",
    vertexOffset,
  });
  lines.push(...textSection.lines);

  return lines.join("\n");
}

function buildMtlContent({ plateColor, textColor }) {
  const plate = rgbToNormalized(plateColor.rgb).map((c) => c.toFixed(6));
  const text = rgbToNormalized(textColor.rgb).map((c) => c.toFixed(6));
  return [
    "newmtl Plate",
    `Kd ${plate.join(" ")}`,
    "",
    "newmtl Text",
    `Kd ${text.join(" ")}`,
    "",
  ].join("\n");
}

function summarizeText(lines) {
  const firstLine = lines && lines.length ? lines[0] : "label";
  return (
    firstLine.replace(/\s+/g, "_").replace(/[^a-z0-9_-]/gi, "").toLowerCase() ||
    "label"
  );
}

export async function buildObjZip({
  plateGeometry,
  textGeometry,
  colors,
  lines,
}) {
  if (!plateGeometry || !textGeometry) {
    throw new Error("Missing geometry for export.");
  }

  const objContent = buildObjContent({ plateGeometry, textGeometry });
  const mtlContent = buildMtlContent({
    plateColor: colors.plate,
    textColor: colors.text,
  });

  const zip = new JSZip();
  zip.file("label.obj", objContent);
  zip.file("label.mtl", mtlContent);

  const blob = await zip.generateAsync({ type: "blob" });
  const filename = `label_${summarizeText(lines)}.zip`;
  return { blob, filename };
}

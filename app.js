import { FontLoader } from "./vendor/three/examples/jsm/loaders/FontLoader.js";
import {
  computeLayout,
  layoutState,
  setLayoutValue,
} from "./layout.js";
import { buildRoundedRectPlate, buildTextGeometry } from "./three-geom.js";
import { ThreePreview } from "./three-preview.js";

const elements = { layoutInputs: {} };

const state = {
  lines: ["", "", ""],
  font: null,
  layout: null,
  basePlateGeometry: null,
  plateGeometry: null,
  textGeometry: null,
  forceCaps: true,
};

let preview;

function normalizeLineValue(value) {
  if (!value) return "";
  const collapsed = value.replace(/\s+/g, " ").trim();
  return state.forceCaps ? collapsed.toUpperCase() : collapsed;
}

function prepareLines(values) {
  const lines = [];
  const indices = [];
  (values || []).forEach((value, index) => {
    const normalized = normalizeLineValue(value);
    if (normalized) {
      lines.push(normalized);
      indices.push(index);
    }
  });
  return { lines, indices };
}

function cacheElements() {
  elements.lineInputs = Array.from(document.querySelectorAll(".line-input"));
  state.lines = elements.lineInputs.map((input) => input.value || "");
  elements.downloadPlateBtn = document.getElementById("download-plate-btn");
  elements.downloadTextBtn = document.getElementById("download-text-btn");
  elements.capsToggle = document.getElementById("caps-toggle");
  elements.status = document.getElementById("status");
  elements.canvas = document.getElementById("preview");
  elements.layoutInputs = {
    plateWidthMm: document.getElementById("plate-width"),
    plateHeightMm: document.getElementById("plate-height"),
    plateThicknessMm: document.getElementById("plate-thickness"),
    textDepthMm: document.getElementById("text-depth"),
    textEmbedMm: document.getElementById("text-embed"),
    horizontalPaddingMm: document.getElementById("horizontal-padding"),
    verticalPaddingMm: document.getElementById("vertical-padding"),
    lineSpacingMm: document.getElementById("line-spacing"),
  };
}

function setStatus(message, isError = false) {
  if (!elements.status) return;
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

function setDownloadButtonsDisabled(disabled) {
  if (elements.downloadPlateBtn) {
    elements.downloadPlateBtn.disabled = disabled;
  }
  if (elements.downloadTextBtn) {
    elements.downloadTextBtn.disabled = disabled;
  }
}

function geometryToAsciiStl(geometry, solidName) {
  if (!geometry) {
    throw new Error(`Missing geometry for ${solidName}`);
  }
  const working = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const positionAttr = working.getAttribute("position");
  const lines = [`solid ${solidName}`];

  for (let i = 0; i < positionAttr.count; i += 3) {
    const ax = positionAttr.getX(i);
    const ay = positionAttr.getY(i);
    const az = positionAttr.getZ(i);
    const bx = positionAttr.getX(i + 1);
    const by = positionAttr.getY(i + 1);
    const bz = positionAttr.getZ(i + 1);
    const cx = positionAttr.getX(i + 2);
    const cy = positionAttr.getY(i + 2);
    const cz = positionAttr.getZ(i + 2);

    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;
    const acx = cx - ax;
    const acy = cy - ay;
    const acz = cz - az;

    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    const length = Math.hypot(nx, ny, nz) || 1;
    const nnx = nx / length;
    const nny = ny / length;
    const nnz = nz / length;

    lines.push(
      `  facet normal ${nnx.toFixed(6)} ${nny.toFixed(6)} ${nnz.toFixed(6)}`,
      "    outer loop",
      `      vertex ${ax.toFixed(6)} ${ay.toFixed(6)} ${az.toFixed(6)}`,
      `      vertex ${bx.toFixed(6)} ${by.toFixed(6)} ${bz.toFixed(6)}`,
      `      vertex ${cx.toFixed(6)} ${cy.toFixed(6)} ${cz.toFixed(6)}`,
      "    endloop",
      "  endfacet"
    );
  }

  lines.push(`endsolid ${solidName}`);
  working.dispose();
  return lines.join("\n");
}

function sanitizeFilenameComponent(value) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/^_+|_+$/g, "");
}

function buildFilename(prefix) {
  const parts = (state.layout?.lines && state.layout.lines.length
    ? state.layout.lines
    : state.lines
  ).map((line) => sanitizeFilenameComponent(line));

  const joined = parts.filter(Boolean).join("_") || "label";
  return `${prefix}_${joined}.stl`;
}

function updateBasePlateGeometry() {
  if (state.basePlateGeometry?.dispose) {
    state.basePlateGeometry.dispose();
  }
  state.basePlateGeometry = buildRoundedRectPlate();
}

function handleLayoutInputChange(key, rawValue) {
  const input = elements.layoutInputs[key];
  if (!input) return;
  const value = Number(rawValue);
  const min = input.min !== "" ? Number(input.min) : null;
  if (!Number.isFinite(value) || (min != null && value < min)) {
    input.value = layoutState[key];
    return;
  }

  if (value === layoutState[key]) {
    return;
  }

  setLayoutValue(key, value);
  updateBasePlateGeometry();
  scheduleUpdate();
}

function rebuildTextGeometry() {
  if (state.textGeometry) {
    state.textGeometry.dispose();
    state.textGeometry = null;
  }

  if (!state.layout?.fits || !state.layout.lineCount) {
    preview?.setTextGeometry(null);
    rebuildPlateGeometry();
    return;
  }

  state.textGeometry = buildTextGeometry({
    lines: state.layout.lines,
    font: state.font,
    fontSize: state.layout.fontSize,
    depth: layoutState.textDepthMm,
    lineSpacing: layoutState.lineSpacingMm,
    baselineOffsets: state.layout.baselineOffsets,
  });

  preview?.setTextGeometry(state.textGeometry.clone());
  rebuildPlateGeometry();
}

function rebuildPlateGeometry() {
  if (!state.basePlateGeometry) return;

  if (state.plateGeometry?.dispose) {
    state.plateGeometry.dispose();
    state.plateGeometry = null;
  }

  state.plateGeometry = state.basePlateGeometry.clone();
  preview?.setPlateGeometry(state.plateGeometry.clone());
}

function updateLayout() {
  if (!state.font) {
    state.layout = null;
    setStatus("Loading font...", false);
    setDownloadButtonsDisabled(true);
    return;
  }

  const prepared = prepareLines(state.lines);
  state.layout = {
    ...computeLayout({
      lines: prepared.lines,
      font: state.font,
    }),
    inputOrder: prepared.indices,
  };

  if (!state.layout.lineCount) {
    setDownloadButtonsDisabled(true);
    setStatus("Enter text to generate a label.", false);
    rebuildTextGeometry();
    return;
  }

  if (!state.layout.fits) {
    setDownloadButtonsDisabled(true);
    const lineNumber =
      (state.layout.overflowIndex != null &&
        state.layout.inputOrder[state.layout.overflowIndex] + 1) ||
      (state.layout.overflowIndex != null
        ? state.layout.overflowIndex + 1
        : 1);
    setStatus(`Line ${lineNumber} is too long. Shorten it.`, true);
    rebuildTextGeometry();
    return;
  }

  setDownloadButtonsDisabled(false);
  const statusText = [
    `${state.layout.lineCount} line${state.layout.lineCount > 1 ? "s" : ""}`,
    `font ${state.layout.fontSize.toFixed(1)} mm`,
  ].join(" · ");
  setStatus(statusText, false);
  rebuildTextGeometry();
}

function scheduleUpdate() {
  updateLayout();
}

function downloadGeometryAsStl(geometry, filename) {
  const stlContent = geometryToAsciiStl(geometry, filename.replace(/\..+$/, ""));
  const blob = new Blob([stlContent], { type: "model/stl" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function handlePlateDownload() {
  if (!state.plateGeometry) {
    setStatus("Plate geometry is not ready.", true);
    return;
  }
  try {
    downloadGeometryAsStl(state.plateGeometry, buildFilename("plate"));
    setStatus("Plate STL export complete.", false);
  } catch (error) {
    console.error(error);
    setStatus("Failed to export plate STL.", true);
  }
}

function handleTextDownload() {
  if (!state.textGeometry) {
    setStatus("Text geometry is not ready.", true);
    return;
  }
  try {
    downloadGeometryAsStl(state.textGeometry, buildFilename("text"));
    setStatus("Text STL export complete.", false);
  } catch (error) {
    console.error(error);
    setStatus("Failed to export text STL.", true);
  }
}

function attachEvents() {
  elements.lineInputs.forEach((input, index) => {
    input.addEventListener("input", (event) => {
      state.lines[index] = event.target.value;
      scheduleUpdate();
    });
  });

  elements.capsToggle?.addEventListener("change", (event) => {
    state.forceCaps = !!event.target.checked;
    state.lines = state.lines.map((line, index) => {
      const input = elements.lineInputs[index];
      const currentValue = input?.value ?? line;
      const normalized = normalizeLineValue(currentValue);
      if (input) {
        input.value = normalized;
      }
      return normalized;
    });
    scheduleUpdate();
  });

  Object.entries(elements.layoutInputs).forEach(([key, input]) => {
    if (!input) return;
    input.value = layoutState[key];
    input.addEventListener("change", (event) => {
      handleLayoutInputChange(key, event.target.value);
    });
  });

  elements.downloadPlateBtn?.addEventListener("click", handlePlateDownload);
  elements.downloadTextBtn?.addEventListener("click", handleTextDownload);
}

async function loadFont() {
  const loader = new FontLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      "./three-font/helvetiker_bold.typeface.json",
      (font) => resolve(font),
      undefined,
      (err) => reject(err)
    );
  });
}

async function init() {
  cacheElements();
  if (elements.capsToggle) {
    elements.capsToggle.checked = state.forceCaps;
  }
  attachEvents();
  setDownloadButtonsDisabled(true);
  preview = new ThreePreview(elements.canvas);
  updateBasePlateGeometry();
  state.plateGeometry = state.basePlateGeometry.clone();
  preview.setPlateGeometry(state.plateGeometry.clone());

  try {
    state.font = await loadFont();
    setStatus("Font loaded. Ready.", false);
  } catch (error) {
    console.error(error);
    setStatus("Failed to load font JSON.", true);
    return;
  }

  scheduleUpdate();
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

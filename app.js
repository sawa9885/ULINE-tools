import { FontLoader } from "./vendor/three/examples/jsm/loaders/FontLoader.js";
import {
  computeLayout,
  layoutState,
  setLayoutValue,
  resetLayoutState,
} from "./layout.js";
import { buildRoundedRectPlate, buildTextGeometry } from "./three-geom.js";
import { buildWedgeSolid, wedgeDefaults } from "./wedge-geom.js";
import { ThreePreview } from "./three-preview.js";

const TOOL_TYPES = {
  LABEL: "label",
  WEDGE: "wedge",
};

const elements = {
  layoutInputs: {},
  wedgeInputs: {},
};

const state = {
  tool: TOOL_TYPES.LABEL,
  forceCaps: true,
  lines: ["", "", ""],
  font: null,
  layout: null,
  basePlateGeometry: null,
  plateGeometry: null,
  textGeometry: null,
  wedgeGeometry: null,
  wedge: { ...wedgeDefaults },
};

let preview;

function sanitizeLine(value) {
  if (!value) return "";
  const collapsed = value.replace(/\s+/g, " ");
  return state.forceCaps ? collapsed.toUpperCase() : collapsed;
}

function cacheElements() {
  elements.lineInputs = Array.from(document.querySelectorAll(".line-input"));
  state.lines = elements.lineInputs.map((input) => input.value || "");
  elements.downloadPlateBtn = document.getElementById("download-plate-btn");
  elements.downloadTextBtn = document.getElementById("download-text-btn");
  elements.downloadWedgeBtn = document.getElementById("download-wedge-btn");
  elements.capsToggle = document.getElementById("caps-toggle");
  elements.status = document.getElementById("status");
  elements.canvas = document.getElementById("preview");
  elements.tabButtons = Array.from(document.querySelectorAll(".tab"));
  elements.labelPanel = document.getElementById("label-panel");
  elements.wedgePanel = document.getElementById("wedge-panel");

  elements.layoutInputs = {
    plateWidthMm: document.getElementById("plate-width"),
    plateHeightMm: document.getElementById("plate-height"),
    plateThicknessMm: document.getElementById("plate-thickness"),
    textDepthMm: document.getElementById("text-depth"),
    textEmbedMm: document.getElementById("text-embed"),
    paddingTopMm: document.getElementById("padding-top"),
    paddingRightMm: document.getElementById("padding-right"),
    paddingBottomMm: document.getElementById("padding-bottom"),
    paddingLeftMm: document.getElementById("padding-left"),
    lineSpacingMm: document.getElementById("line-spacing"),
  };

  elements.wedgeInputs = {
    baseLength: document.getElementById("wedge-base-length"),
    height: document.getElementById("wedge-height"),
    tipHeight: document.getElementById("wedge-tip"),
    filletRadius: document.getElementById("wedge-fillet"),
    extrusionLength: document.getElementById("wedge-length"),
  };
}

function setStatus(message, isError = false) {
  if (!elements.status) return;
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

function setLabelDownloadDisabled(disabled) {
  if (elements.downloadPlateBtn) {
    elements.downloadPlateBtn.disabled = disabled;
  }
  if (elements.downloadTextBtn) {
    elements.downloadTextBtn.disabled = disabled;
  }
}

function normalizeLinesFromInputs() {
  const nonEmpty = [];
  const indices = [];
  state.lines = elements.lineInputs.map((input, index) => {
    const normalized = sanitizeLine(input.value || "");
    if (input && input.value !== normalized) {
      input.value = normalized;
    }
    if (normalized) {
      nonEmpty.push(normalized);
      indices.push(index);
    }
    return normalized;
  });
  return { values: nonEmpty, indices };
}

function updateBasePlateGeometry() {
  if (state.basePlateGeometry?.dispose) {
    state.basePlateGeometry.dispose();
  }
  state.basePlateGeometry = buildRoundedRectPlate();
}

function cloneGeometry(geometry) {
  if (!geometry) return null;
  const clone = geometry.clone();
  clone.computeBoundingBox();
  clone.computeBoundingSphere();
  return clone;
}

function rebuildPlateGeometry() {
  if (!state.basePlateGeometry) return;

  if (state.plateGeometry?.dispose) {
    state.plateGeometry.dispose();
    state.plateGeometry = null;
  }

  state.plateGeometry = state.basePlateGeometry.clone();
  preview?.setPlateGeometry(cloneGeometry(state.plateGeometry));
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

  preview?.setTextGeometry(cloneGeometry(state.textGeometry));
  rebuildPlateGeometry();
}

function updateLayout() {
  if (!state.font) {
    state.layout = null;
    setStatus("Loading font...", false);
    setLabelDownloadDisabled(true);
    return;
  }

  const prepared = normalizeLinesFromInputs();
  state.layout = {
    ...computeLayout({
      lines: prepared.values,
      font: state.font,
    }),
    inputOrder: prepared.indices,
  };

  if (!state.layout.lineCount) {
    setLabelDownloadDisabled(true);
    setStatus("Enter text to generate a label.", false);
    rebuildTextGeometry();
    return;
  }

  if (!state.layout.fits) {
    setLabelDownloadDisabled(true);
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

  setLabelDownloadDisabled(false);
  const statusText = [
    `${state.layout.lineCount} line${state.layout.lineCount > 1 ? "s" : ""}`,
    `font ${state.layout.fontSize.toFixed(1)} mm`,
  ].join(" · ");
  setStatus(statusText, false);
  rebuildTextGeometry();
}

function rebuildWedgeGeometry() {
  if (state.wedgeGeometry?.dispose) {
    state.wedgeGeometry.dispose();
    state.wedgeGeometry = null;
  }

  state.wedgeGeometry = buildWedgeSolid(state.wedge);
  preview?.setPlateGeometry(cloneGeometry(state.wedgeGeometry));
  preview?.setTextGeometry(null);

  if (elements.downloadWedgeBtn) {
    elements.downloadWedgeBtn.disabled = !state.wedgeGeometry;
  }

  if (state.tool === TOOL_TYPES.WEDGE) {
    setStatus("Wedge ready.", false);
  }
}

function scheduleUpdate() {
  if (state.tool === TOOL_TYPES.LABEL) {
    updateLayout();
  } else {
    rebuildWedgeGeometry();
  }
}

function downloadGeometryAsStl(geometry, filename) {
  if (!geometry) throw new Error("Missing geometry for export.");
  const working = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const position = working.getAttribute("position");
  const lines = [`solid ${filename}`];

  for (let i = 0; i < position.count; i += 3) {
    const ax = position.getX(i);
    const ay = position.getY(i);
    const az = position.getZ(i);
    const bx = position.getX(i + 1);
    const by = position.getY(i + 1);
    const bz = position.getZ(i + 1);
    const cx = position.getX(i + 2);
    const cy = position.getY(i + 2);
    const cz = position.getZ(i + 2);

    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;
    const acx = cx - ax;
    const acy = cy - ay;
    const acz = cz - az;

    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    const len = Math.hypot(nx, ny, nz) || 1;
    const nnx = nx / len;
    const nny = ny / len;
    const nnz = nz / len;

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

  lines.push(`endsolid ${filename}`);
  working.dispose();
  const blob = new Blob([lines.join("\n")], { type: "model/stl" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.stl`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function sanitizeFilenameComponent(value) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/^_+|_+$/g, "");
}

function buildLabelFilename(prefix) {
  const parts = state.lines
    .map((line) => sanitizeFilenameComponent(line))
    .filter(Boolean);
  const joined = parts.join("_") || "label";
  return `${prefix}_${joined}`;
}

function buildWedgeFilename() {
  const { baseLength, height, tipHeight, filletRadius, extrusionLength } = state.wedge;
  const descriptor = `${baseLength}x${height}x${tipHeight}x${filletRadius}x${extrusionLength}`
    .replace(/\s+/g, "")
    .replace(/[^0-9x.]/g, "");
  return `wedge_${descriptor}`;
}

function handlePlateDownload() {
  if (!state.plateGeometry) {
    setStatus("Plate geometry is not ready.", true);
    return;
  }
  try {
    downloadGeometryAsStl(state.plateGeometry, buildLabelFilename("plate"));
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
    downloadGeometryAsStl(state.textGeometry, buildLabelFilename("text"));
    setStatus("Text STL export complete.", false);
  } catch (error) {
    console.error(error);
    setStatus("Failed to export text STL.", true);
  }
}

function handleWedgeDownload() {
  if (!state.wedgeGeometry) {
    setStatus("Build the wedge first.", true);
    return;
  }
  try {
    downloadGeometryAsStl(state.wedgeGeometry, buildWedgeFilename());
    setStatus("Wedge STL export complete.", false);
  } catch (error) {
    console.error(error);
    setStatus("Failed to export wedge STL.", true);
  }
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
  if (value === layoutState[key]) return;
  setLayoutValue(key, value);
  updateBasePlateGeometry();
  scheduleUpdate();
}

function handleWedgeInputChange(key, rawValue) {
  const input = elements.wedgeInputs[key];
  if (!input) return;
  const value = Number(rawValue);
  const min = input.min !== "" ? Number(input.min) : null;
  if (!Number.isFinite(value) || (min != null && value < min)) {
    input.value = state.wedge[key];
    return;
  }
  if (value === state.wedge[key]) return;
  state.wedge[key] = value;
  scheduleUpdate();
}

function setTool(tool) {
  if (state.tool === tool) return;
  state.tool = tool;
  updateToolUI();
  setStatus(tool === TOOL_TYPES.LABEL ? "Label tool active." : "Wedge tool active.", false);
  scheduleUpdate();
}

function updateToolUI() {
  elements.tabButtons?.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tool === state.tool);
  });
  elements.labelPanel?.classList.toggle("active", state.tool === TOOL_TYPES.LABEL);
  elements.wedgePanel?.classList.toggle("active", state.tool === TOOL_TYPES.WEDGE);
  if (state.tool === TOOL_TYPES.LABEL) {
    setLabelDownloadDisabled(!state.layout?.fits);
    if (elements.downloadWedgeBtn) elements.downloadWedgeBtn.disabled = true;
  } else {
    setLabelDownloadDisabled(true);
    if (elements.downloadWedgeBtn) elements.downloadWedgeBtn.disabled = !state.wedgeGeometry;
  }
}

function attachEvents() {
  elements.lineInputs.forEach((input, index) => {
    input.addEventListener("input", () => {
      state.lines[index] = input.value;
      scheduleUpdate();
    });
  });

  elements.capsToggle?.addEventListener("change", (event) => {
    state.forceCaps = !!event.target.checked;
    normalizeLinesFromInputs();
    scheduleUpdate();
  });

  Object.entries(elements.layoutInputs).forEach(([key, input]) => {
    if (!input) return;
    input.value = layoutState[key];
    input.addEventListener("change", (event) => {
      handleLayoutInputChange(key, event.target.value);
    });
  });

  Object.entries(elements.wedgeInputs).forEach(([key, input]) => {
    if (!input) return;
    input.value = state.wedge[key];
    input.addEventListener("change", (event) => {
      handleWedgeInputChange(key, event.target.value);
    });
  });

  elements.downloadPlateBtn?.addEventListener("click", handlePlateDownload);
  elements.downloadTextBtn?.addEventListener("click", handleTextDownload);
  elements.downloadWedgeBtn?.addEventListener("click", handleWedgeDownload);

  elements.tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tool = button.dataset.tool;
      if (tool) setTool(tool);
    });
  });
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
  resetLayoutState();
  attachEvents();
  updateToolUI();
  setLabelDownloadDisabled(true);
  if (elements.capsToggle) {
    elements.capsToggle.checked = state.forceCaps;
  }

  preview = new ThreePreview(elements.canvas);
  updateBasePlateGeometry();
  state.plateGeometry = cloneGeometry(state.basePlateGeometry);
  preview.setPlateGeometry(cloneGeometry(state.plateGeometry));

  try {
    state.font = await loadFont();
    setStatus("Font loaded. Ready.", false);
  } catch (error) {
    console.error(error);
    setStatus("Failed to load font JSON.", true);
    return;
  }

  normalizeLinesFromInputs();
  scheduleUpdate();
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

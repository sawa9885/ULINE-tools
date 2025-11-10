import { FontLoader } from "./vendor/three/examples/jsm/loaders/FontLoader.js";
import {
  computeLayout,
  LINE_SPACING_MM,
  TEXT_DEPTH_MM,
} from "./layout.js";
import { buildRoundedRectPlate, buildTextGeometry } from "./three-geom.js";
import { ThreePreview } from "./three-preview.js";
import { COLOR_OPTIONS } from "./colors.js";
import { buildObjZip } from "./export-obj.js";

const elements = {};

const state = {
  lines: ["", "", ""],
  font: null,
  layout: null,
  plateGeometry: null,
  textGeometry: null,
  plateColor: COLOR_OPTIONS[0],
  textColor: COLOR_OPTIONS[1],
};

let preview;

function normalizeLineValue(value) {
  return value ? value.replace(/\s+/g, " ").trim() : "";
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
  elements.plateSelect = document.getElementById("plate-color");
  elements.textSelect = document.getElementById("text-color");
  elements.downloadBtn = document.getElementById("download-btn");
  elements.status = document.getElementById("status");
  elements.canvas = document.getElementById("preview");
}

function populateColorSelect(selectEl, defaultName) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  COLOR_OPTIONS.forEach((option, index) => {
    const opt = document.createElement("option");
    opt.value = index.toString();
    opt.textContent = option.name;
    selectEl.appendChild(opt);
  });
  const defaultIndex = COLOR_OPTIONS.findIndex(
    (opt) => opt.name.toLowerCase() === defaultName.toLowerCase()
  );
  selectEl.value = (defaultIndex >= 0 ? defaultIndex : 0).toString();
}

function getSelectedColor(selectEl) {
  const index = Number(selectEl?.value) || 0;
  return COLOR_OPTIONS[index] || COLOR_OPTIONS[0];
}

function setStatus(message, isError = false) {
  if (!elements.status) return;
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

function setDownloadDisabled(disabled) {
  if (elements.downloadBtn) {
    elements.downloadBtn.disabled = disabled;
  }
}

function rebuildTextGeometry() {
  if (state.textGeometry) {
    state.textGeometry.dispose();
    state.textGeometry = null;
  }

  if (!state.layout?.fits || !state.layout.lineCount) {
    preview?.setTextGeometry(null);
    return;
  }

  state.textGeometry = buildTextGeometry({
    lines: state.layout.lines,
    font: state.font,
    fontSize: state.layout.fontSize,
    depth: TEXT_DEPTH_MM,
    lineSpacing: LINE_SPACING_MM,
    baselineOffsets: state.layout.baselineOffsets,
  });

  preview?.setTextGeometry(state.textGeometry);
}

function updateColors() {
  state.plateColor = getSelectedColor(elements.plateSelect);
  state.textColor = getSelectedColor(elements.textSelect);
  preview?.updateMaterials({
    plateColor: state.plateColor.rgb,
    textColor: state.textColor.rgb,
  });
}

function updateLayout() {
  if (!state.font) {
    state.layout = null;
    setStatus("Loading font...", false);
    setDownloadDisabled(true);
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
    setDownloadDisabled(true);
    setStatus("Enter text to generate a label.", false);
    rebuildTextGeometry();
    return;
  }

  if (!state.layout.fits) {
    setDownloadDisabled(true);
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

  setDownloadDisabled(false);
  const statusText = [
    `${state.layout.lineCount} line${
      state.layout.lineCount > 1 ? "s" : ""
    }`,
    `font ${state.layout.fontSize.toFixed(1)} mm`,
  ].join(" · ");
  setStatus(statusText, false);
  rebuildTextGeometry();
}

function scheduleUpdate() {
  updateLayout();
  updateColors();
}

async function handleDownload() {
  if (!state.layout?.fits || !state.layout.lineCount) {
    return;
  }

  setStatus("Building OBJ...", false);
  try {
    setDownloadDisabled(true);
    const { blob, filename } = await buildObjZip({
      plateGeometry: state.plateGeometry,
      textGeometry: state.textGeometry,
      colors: { plate: state.plateColor, text: state.textColor },
      lines: state.layout.lines,
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    setStatus("OBJ export complete.", false);
  } catch (error) {
    console.error(error);
    setStatus("Failed to export OBJ. See console for details.", true);
  } finally {
    setDownloadDisabled(!(state.layout?.fits && state.layout?.lineCount));
  }
}

function attachEvents() {
  elements.lineInputs.forEach((input, index) => {
    input.addEventListener("input", (event) => {
      state.lines[index] = event.target.value;
      scheduleUpdate();
    });
  });

  elements.plateSelect?.addEventListener("change", () => {
    updateColors();
  });
  elements.textSelect?.addEventListener("change", () => {
    updateColors();
  });

  elements.downloadBtn?.addEventListener("click", () => {
    handleDownload();
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
  populateColorSelect(elements.plateSelect, "Black");
  populateColorSelect(elements.textSelect, "White");
  attachEvents();
  preview = new ThreePreview(elements.canvas);
  state.plateGeometry = buildRoundedRectPlate({});
  preview.setPlateGeometry(state.plateGeometry);
  updateColors();

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

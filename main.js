const canvas = document.getElementById('image-canvas');
const context = canvas.getContext('2d', { willReadFrequently: true });
const magnifierCanvas = document.getElementById('magnifier-canvas');
const magnifierContext = magnifierCanvas.getContext('2d');
const dropZone = document.getElementById('drop-zone');
const emptyState = document.getElementById('empty-state');
const magnifier = document.getElementById('magnifier');
const cursorMarker = document.getElementById('cursor-marker');
const fileInput = document.getElementById('file-input');
const imageMeta = document.getElementById('image-meta');
const zoomLabel = document.getElementById('zoom-label');
const statusMessage = document.getElementById('status-message');
const colorPreview = document.getElementById('color-preview');
const colorName = document.getElementById('color-name');
const hexValue = document.getElementById('hex-value');
const rgbValue = document.getElementById('rgb-value');
const hslValue = document.getElementById('hsl-value');
const cssValue = document.getElementById('css-value');
const pixelPosition = document.getElementById('pixel-position');
const historyList = document.getElementById('history-list');

let sourceImage = null;
let currentColor = null;
let zoom = 1;
let fitZoom = 1;
let history = [];

document.getElementById('choose-button').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => { const file = fileInput.files && fileInput.files[0]; if (file) loadFile(file); fileInput.value = ''; });
document.getElementById('clear-button').addEventListener('click', clearImage);
document.getElementById('fit-button').addEventListener('click', () => { if (!sourceImage) return; zoom = fitZoom; renderImage(); });
document.getElementById('zoom-in-button').addEventListener('click', () => setZoom(zoom + 0.1));
document.getElementById('zoom-out-button').addEventListener('click', () => setZoom(zoom - 0.1));
document.getElementById('clear-history-button').addEventListener('click', clearHistory);

window.addEventListener('paste', (event) => {
  const items = event.clipboardData && event.clipboardData.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.indexOf('image/') === 0) {
      const file = item.getAsFile();
      if (file) { event.preventDefault(); loadFile(file); }
      return;
    }
  }
});

['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.add('drag-over'); }));
['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.remove('drag-over'); }));
dropZone.addEventListener('drop', (event) => { const files = event.dataTransfer && event.dataTransfer.files; const file = files && Array.from(files).find((item) => item.type.indexOf('image/') === 0); if (file) loadFile(file); });

canvas.addEventListener('mousemove', handleCanvasMove);
canvas.addEventListener('mouseleave', () => { magnifier.style.display = 'none'; cursorMarker.style.display = 'none'; });
canvas.addEventListener('click', () => { if (currentColor) { addToHistory(currentColor); copyText(currentColor.hex, 'HEX 已复制'); } });

document.querySelectorAll('[data-copy-target]').forEach((button) => button.addEventListener('click', () => {
  const target = document.getElementById(button.dataset.copyTarget);
  const label = button.querySelector('.value-label');
  if (target && target.textContent !== '—') copyText(target.textContent, (label ? label.textContent : '颜色') + ' 已复制');
}));

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') clearImage();
  if ((event.ctrlKey || event.metaKey) && (event.key === '+' || event.key === '=')) { event.preventDefault(); setZoom(zoom + 0.1); }
  if ((event.ctrlKey || event.metaKey) && event.key === '-') { event.preventDefault(); setZoom(zoom - 0.1); }
});

function loadFile(file) {
  if (file.type.indexOf('image/') !== 0) { showStatus('请选择图片文件'); return; }
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(url);
    sourceImage = image;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    fitZoom = calculateFitZoom();
    zoom = fitZoom;
    emptyState.style.display = 'none';
    canvas.style.display = 'block';
    document.getElementById('canvas-hint').style.display = 'block';
    imageMeta.textContent = image.naturalWidth + ' × ' + image.naturalHeight;
    clearSelection();
    renderImage();
    showStatus('图片已加载，移动鼠标查看像素颜色');
  };
  image.onerror = () => { URL.revokeObjectURL(url); showStatus('图片加载失败，请重试'); };
  image.src = url;
}

function calculateFitZoom() {
  const availableWidth = Math.max(dropZone.clientWidth - 48, 1);
  const availableHeight = Math.max(dropZone.clientHeight - 48, 1);
  return Math.min(1, availableWidth / canvas.width, availableHeight / canvas.height);
}

function renderImage() {
  if (!sourceImage) return;
  canvas.style.width = canvas.width * zoom + 'px';
  canvas.style.height = canvas.height * zoom + 'px';
  zoomLabel.textContent = Math.round(zoom * 100) + '%';
}

function setZoom(nextZoom) { if (!sourceImage) return; zoom = Math.min(4, Math.max(0.1, Math.round(nextZoom * 10) / 10)); renderImage(); }

function getImagePoint(event) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) * canvas.width / rect.width);
  const y = Math.floor((event.clientY - rect.top) * canvas.height / rect.height);
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null;
  return { x, y };
}

function handleCanvasMove(event) {
  const point = getImagePoint(event);
  if (!point) return;
  const pixel = context.getImageData(point.x, point.y, 1, 1).data;
  currentColor = createColor(pixel[0], pixel[1], pixel[2], pixel[3], point.x, point.y);
  updateColorPanel(currentColor);
  positionCursor(event);
  drawMagnifier(point.x, point.y);
}

function positionCursor(event) {
  const zoneRect = dropZone.getBoundingClientRect();
  const left = event.clientX - zoneRect.left;
  const top = event.clientY - zoneRect.top;
  cursorMarker.style.left = left + 'px';
  cursorMarker.style.top = top + 'px';
  cursorMarker.style.display = 'block';
  const size = 184;
  const x = left + 22 + size > dropZone.clientWidth ? left - size - 22 : left + 22;
  const y = top + 22 + size > dropZone.clientHeight ? top - size - 22 : top + 22;
  magnifier.style.left = Math.max(8, x) + 'px';
  magnifier.style.top = Math.max(8, y) + 'px';
  magnifier.style.display = 'block';
}

function drawMagnifier(x, y) {
  const size = 11;
  const startX = Math.max(0, Math.min(canvas.width - size, x - 5));
  const startY = Math.max(0, Math.min(canvas.height - size, y - 5));
  magnifierContext.imageSmoothingEnabled = false;
  magnifierContext.clearRect(0, 0, magnifierCanvas.width, magnifierCanvas.height);
  magnifierContext.drawImage(canvas, startX, startY, size, size, 0, 0, 168, 168);
}

function createColor(r, g, b, a, x, y) { const hsl = rgbToHsl(r, g, b); return { r, g, b, a, x, y, hex: '#' + toHex(r) + toHex(g) + toHex(b), hsl: 'hsl(' + hsl.h + ', ' + hsl.s + '%, ' + hsl.l + '%)' }; }
function updateColorPanel(color) { colorPreview.style.backgroundColor = color.hex; colorName.textContent = color.hex; hexValue.textContent = color.hex; rgbValue.textContent = 'rgb(' + color.r + ', ' + color.g + ', ' + color.b + ')'; hslValue.textContent = color.hsl; cssValue.textContent = 'color: ' + color.hex + ';'; pixelPosition.textContent = color.x + ', ' + color.y; }

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const lightness = (max + min) / 2; const delta = max - min;
  let hue = 0; let saturation = 0;
  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === r) hue = ((g - b) / delta) % 6; else if (max === g) hue = (b - r) / delta + 2; else hue = (r - g) / delta + 4;
    hue = Math.round(hue * 60); if (hue < 0) hue += 360;
  }
  return { h: hue, s: Math.round(saturation * 100), l: Math.round(lightness * 100) };
}

function toHex(value) { return value.toString(16).padStart(2, '0').toUpperCase(); }
async function copyText(value, message) { try { await navigator.clipboard.writeText(value); showStatus(message + '：' + value); } catch { showStatus('复制失败，请检查剪贴板权限'); } }

function addToHistory(color) { history = [color].concat(history.filter((item) => item.hex !== color.hex)).slice(0, 12); renderHistory(); }
function renderHistory() {
  historyList.replaceChildren();
  if (history.length === 0) { const empty = document.createElement('span'); empty.className = 'history-empty'; empty.textContent = '点击图片取色后会显示在这里'; historyList.append(empty); return; }
  history.forEach((color) => { const swatch = document.createElement('button'); swatch.type = 'button'; swatch.className = 'history-swatch'; swatch.style.backgroundColor = color.hex; swatch.title = color.hex + '，点击复制'; swatch.setAttribute('aria-label', '复制 ' + color.hex); swatch.addEventListener('click', () => copyText(color.hex, 'HEX 已复制')); historyList.append(swatch); });
}

function clearSelection() { currentColor = null; colorPreview.style.backgroundColor = '#eef2f3'; colorName.textContent = '尚未选择'; hexValue.textContent = '—'; rgbValue.textContent = '—'; hslValue.textContent = '—'; cssValue.textContent = '—'; pixelPosition.textContent = '—'; magnifier.style.display = 'none'; cursorMarker.style.display = 'none'; }
function clearImage() { sourceImage = null; canvas.style.display = 'none'; emptyState.style.display = 'flex'; document.getElementById('canvas-hint').style.display = 'none'; imageMeta.textContent = '等待导入图片'; clearSelection(); showStatus('已清空图片'); }
function clearHistory() { history = []; renderHistory(); showStatus('最近颜色已清空'); }
function showStatus(message) { statusMessage.textContent = message; window.clearTimeout(showStatus.timer); showStatus.timer = window.setTimeout(() => { statusMessage.textContent = ''; }, 3500); }

window.addEventListener('resize', () => { if (!sourceImage) return; const previousFit = fitZoom; fitZoom = calculateFitZoom(); if (Math.abs(zoom - previousFit) < 0.001) { zoom = fitZoom; renderImage(); } });

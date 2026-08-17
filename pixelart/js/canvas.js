/**
 * PixelArt Canvas Viewport and Rendering Engine
 * Handles smooth zooming, panning, pixel grid rendering, guide image overlay,
 * pointer events, and tool interactions for Safari (macOS/iOS) and all modern browsers.
 */

class PixelCanvas {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container #${containerId} not found`);
    }

    // Default dimensions from requirements
    this.width = options.width || 125;
    this.height = options.height || 125;

    // Grid data: 2D array [height][width] storing hex string or null
    this.grid = this.createEmptyGrid(this.width, this.height);

    // Viewport transform
    this.zoom = 6; // screen pixels per grid pixel
    this.minZoom = 0.5;
    this.maxZoom = 64;
    this.panX = 0;
    this.panY = 0;
    this.showGridLines = true;

    // Active tool and state
    this.activeTool = 'pencil'; // 'pencil', 'eraser', 'bucket', 'eyedropper', 'line', 'rect', 'rect-fill', 'circle', 'circle-fill', 'pan', 'move-guide', 'move-art'
    this.isDrawing = false;
    this.isPanning = false;
    this.isMovingGuide = false;
    this.lastPointerGridPos = null;
    this.dragStartGridPos = null;
    this.dragStartScreenPos = null;
    this.guideDragStartOffset = null;
    this.hoverGridPos = null;

    // Shape preview buffer
    this.previewPixels = null;

    // Guide / Reference Image
    this.guideImage = null;
    this.guideVisible = true;
    this.guideOpacity = 0.45;
    this.guideScalePercent = 100; // 100% of grid fit or actual size
    this.guideOffsetX = 0; // in grid pixel units
    this.guideOffsetY = 0;

    // Managers
    this.paletteManager = window.paletteManager;
    this.historyManager = new HistoryManager(50);

    // Multi-touch tracking for iOS gestures
    this.activePointers = new Map();
    this.initialPinchDistance = null;
    this.initialPinchZoom = null;
    this.initialPinchCenter = null;

    // Listeners / event callbacks
    this.onPixelHover = null;
    this.onViewportChange = null;
    this.onStateChange = null;
    this.onColorPicked = null;

    // Setup DOM elements
    this.initDOM();
    this.setupEventListeners();

    // Initial history state
    this.historyManager.pushState(this.grid, this.width, this.height, 'Initial Empty Grid');

    // Initial centering & render
    requestAnimationFrame(() => {
      this.centerGridInView();
      this.render();
    });
  }

  createEmptyGrid(w, h) {
    const grid = [];
    for (let y = 0; y < h; y++) {
      grid.push(new Array(w).fill(null));
    }
    return grid;
  }

  initDOM() {
    this.container.innerHTML = '';
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';
    this.container.style.userSelect = 'none';
    this.container.style.webkitUserSelect = 'none';
    this.container.style.touchAction = 'none';

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'pixelart-main-canvas';
    this.canvas.style.display = 'block';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.cursor = 'crosshair';

    this.ctx = this.canvas.getContext('2d', { alpha: false });

    // Checkerboard pattern canvas
    this.checkerPattern = this.createCheckerPattern();

    this.container.appendChild(this.canvas);
    this.resizeCanvasToContainer();
  }

  createCheckerPattern() {
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 16;
    patternCanvas.height = 16;
    const pctx = patternCanvas.getContext('2d');
    pctx.fillStyle = '#22252a';
    pctx.fillRect(0, 0, 16, 16);
    pctx.fillStyle = '#2b2f36';
    pctx.fillRect(0, 0, 8, 8);
    pctx.fillRect(8, 8, 8, 8);
    return this.ctx.createPattern(patternCanvas, 'repeat');
  }

  resizeCanvasToContainer() {
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvasWidth = Math.max(100, Math.floor(rect.width));
    this.canvasHeight = Math.max(100, Math.floor(rect.height));

    this.canvas.width = this.canvasWidth * dpr;
    this.canvas.height = this.canvasHeight * dpr;
    this.canvas.style.width = `${this.canvasWidth}px`;
    this.canvas.style.height = `${this.canvasHeight}px`;

    this.dpr = dpr;
    this.render();
  }

  centerGridInView() {
    const rect = this.container.getBoundingClientRect();
    const availableW = rect.width - 40;
    const availableH = rect.height - 40;

    // Calculate best fit zoom
    const zoomW = availableW / this.width;
    const zoomH = availableH / this.height;
    let fitZoom = Math.min(zoomW, zoomH);
    fitZoom = Math.max(0.5, Math.min(32, Math.floor(fitZoom * 10) / 10));

    this.zoom = fitZoom > 0 ? fitZoom : 4;
    this.panX = Math.round((rect.width - this.width * this.zoom) / 2);
    this.panY = Math.round((rect.height - this.height * this.zoom) / 2);

    if (this.onViewportChange) {
      this.onViewportChange({ zoom: this.zoom, panX: this.panX, panY: this.panY });
    }
    this.render();
  }

  setZoom(newZoom, centerX = null, centerY = null) {
    newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
    if (newZoom === this.zoom) return;

    if (centerX === null || centerY === null) {
      const rect = this.container.getBoundingClientRect();
      centerX = rect.width / 2;
      centerY = rect.height / 2;
    }

    // Keep the point under pointer stationary
    const gridPointX = (centerX - this.panX) / this.zoom;
    const gridPointY = (centerY - this.panY) / this.zoom;

    this.zoom = newZoom;
    this.panX = Math.round(centerX - gridPointX * this.zoom);
    this.panY = Math.round(centerY - gridPointY * this.zoom);

    if (this.onViewportChange) {
      this.onViewportChange({ zoom: this.zoom, panX: this.panX, panY: this.panY });
    }
    this.render();
  }

  /**
   * Resizing logic: preserves existing drawing unless adjusted to smaller size
   */
  setDimensions(newW, newH) {
    newW = Math.max(1, Math.min(1024, parseInt(newW, 10) || 125));
    newH = Math.max(1, Math.min(1024, parseInt(newH, 10) || 125));

    if (newW === this.width && newH === this.height) return;

    const oldW = this.width;
    const oldH = this.height;
    const newGrid = this.createEmptyGrid(newW, newH);

    // Preserve existing pixels
    const copyW = Math.min(oldW, newW);
    const copyH = Math.min(oldH, newH);

    for (let y = 0; y < copyH; y++) {
      for (let x = 0; x < copyW; x++) {
        newGrid[y][x] = this.grid[y][x];
      }
    }

    this.width = newW;
    this.height = newH;
    this.grid = newGrid;

    this.historyManager.pushState(this.grid, this.width, this.height, `Resize Grid to ${newW}x${newH}`);
    this.saveAutosave();

    if (this.onStateChange) this.onStateChange();
    this.render();
  }

  loadGridData(newGrid, newW, newH) {
    this.width = newW;
    this.height = newH;
    this.grid = newGrid;
    this.historyManager.clear();
    this.historyManager.pushState(this.grid, this.width, this.height, 'Loaded Drawing');
    this.centerGridInView();
    this.saveAutosave();
    if (this.onStateChange) this.onStateChange();
    this.render();
  }

  clearDrawing() {
    this.grid = this.createEmptyGrid(this.width, this.height);
    this.historyManager.pushState(this.grid, this.width, this.height, 'Clear Drawing');
    this.saveAutosave();
    if (this.onStateChange) this.onStateChange();
    this.render();
  }

  /**
   * Coordinate conversions
   */
  screenToGrid(screenX, screenY) {
    const rect = this.container.getBoundingClientRect();
    const relX = screenX - rect.left;
    const relY = screenY - rect.top;

    const gx = Math.floor((relX - this.panX) / this.zoom);
    const gy = Math.floor((relY - this.panY) / this.zoom);

    return {
      x: gx,
      y: gy,
      inBounds: gx >= 0 && gx < this.width && gy >= 0 && gy < this.height
    };
  }

  gridToScreen(gx, gy) {
    return {
      x: this.panX + gx * this.zoom,
      y: this.panY + gy * this.zoom
    };
  }

  /**
   * Event Listeners Setup (Pointer Events for cross-platform macOS Safari / iOS Safari / mouse / touch)
   */
  setupEventListeners() {
    window.addEventListener('resize', () => {
      this.resizeCanvasToContainer();
    });

    const el = this.container;

    // Pointer down
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture?.(e.pointerId);

      // Handle 2-finger pinch gesture start
      if (this.activePointers.size === 2) {
        this.isDrawing = false;
        this.previewPixels = null;
        const pts = Array.from(this.activePointers.values());
        this.initialPinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        this.initialPinchZoom = this.zoom;
        const rect = this.container.getBoundingClientRect();
        this.initialPinchCenter = {
          x: (pts[0].x + pts[1].x) / 2 - rect.left,
          y: (pts[0].y + pts[1].y) / 2 - rect.top
        };
        return;
      }

      if (this.activePointers.size > 2) return;

      const pos = this.screenToGrid(e.clientX, e.clientY);
      const isMiddleClick = e.button === 1;
      const isSpaceHeld = this.isSpacePressed;

      if (isMiddleClick || isSpaceHeld || this.activeTool === 'pan') {
        this.isPanning = true;
        this.dragStartScreenPos = { x: e.clientX, y: e.clientY, panX: this.panX, panY: this.panY };
        this.canvas.style.cursor = 'grabbing';
        return;
      }

      if (this.activeTool === 'move-guide') {
        this.isMovingGuide = true;
        this.dragStartScreenPos = { x: e.clientX, y: e.clientY };
        this.guideDragStartOffset = { x: this.guideOffsetX, y: this.guideOffsetY };
        return;
      }

      // Drawing interaction
      if (e.button === 0) { // Left click or single touch
        this.isDrawing = true;
        this.dragStartGridPos = { x: pos.x, y: pos.y };
        this.lastPointerGridPos = { x: pos.x, y: pos.y };

        if (this.activeTool === 'eyedropper') {
          this.pickColorAt(pos.x, pos.y);
          this.isDrawing = false;
          return;
        }

        if (this.activeTool === 'bucket') {
          if (pos.inBounds) {
            this.applyBucketFill(pos.x, pos.y);
          }
          this.isDrawing = false;
          return;
        }

        if (['line', 'rect', 'rect-fill', 'circle', 'circle-fill'].includes(this.activeTool)) {
          this.updateShapePreview(pos.x, pos.y);
          this.render();
          return;
        }

        // Pencil or Eraser immediate pixel draw
        if (pos.inBounds) {
          const color = this.activeTool === 'eraser' ? null : this.paletteManager.activeColor;
          this.setPixel(pos.x, pos.y, color);
          this.render();
        }
      }
    });

    // Pointer move
    el.addEventListener('pointermove', (e) => {
      if (this.activePointers.has(e.pointerId)) {
        this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      // Handle 2-finger pinch zoom & pan
      if (this.activePointers.size === 2) {
        const pts = Array.from(this.activePointers.values());
        const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (this.initialPinchDistance && this.initialPinchDistance > 0) {
          const scale = currentDist / this.initialPinchDistance;
          const targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.initialPinchZoom * scale));
          this.setZoom(targetZoom, this.initialPinchCenter.x, this.initialPinchCenter.y);
        }
        return;
      }

      const pos = this.screenToGrid(e.clientX, e.clientY);
      this.hoverGridPos = pos.inBounds ? { x: pos.x, y: pos.y } : null;

      if (this.onPixelHover) {
        this.onPixelHover(this.hoverGridPos);
      }

      // Panning
      if (this.isPanning && this.dragStartScreenPos) {
        const dx = e.clientX - this.dragStartScreenPos.x;
        const dy = e.clientY - this.dragStartScreenPos.y;
        this.panX = this.dragStartScreenPos.panX + dx;
        this.panY = this.dragStartScreenPos.panY + dy;
        if (this.onViewportChange) {
          this.onViewportChange({ zoom: this.zoom, panX: this.panX, panY: this.panY });
        }
        this.render();
        return;
      }

      // Moving Guide Image
      if (this.isMovingGuide && this.dragStartScreenPos && this.guideDragStartOffset) {
        const dx = (e.clientX - this.dragStartScreenPos.x) / this.zoom;
        const dy = (e.clientY - this.dragStartScreenPos.y) / this.zoom;
        this.guideOffsetX = Math.round(this.guideDragStartOffset.x + dx);
        this.guideOffsetY = Math.round(this.guideDragStartOffset.y + dy);
        if (this.onStateChange) this.onStateChange();
        this.render();
        return;
      }

      // Drawing
      if (this.isDrawing) {
        if (['line', 'rect', 'rect-fill', 'circle', 'circle-fill'].includes(this.activeTool)) {
          this.updateShapePreview(pos.x, pos.y);
          this.render();
        } else if (this.activeTool === 'pencil' || this.activeTool === 'eraser') {
          if (this.lastPointerGridPos) {
            // Draw continuous line of pixels using Bresenham
            const linePoints = PixelAlgorithms.getLinePixels(
              this.lastPointerGridPos.x,
              this.lastPointerGridPos.y,
              pos.x,
              pos.y
            );
            const color = this.activeTool === 'eraser' ? null : this.paletteManager.activeColor;
            for (const pt of linePoints) {
              if (pt.x >= 0 && pt.x < this.width && pt.y >= 0 && pt.y < this.height) {
                this.setPixel(pt.x, pt.y, color, false);
              }
            }
            this.render();
          }
          this.lastPointerGridPos = { x: pos.x, y: pos.y };
        }
      } else {
        // Just hover highlight
        this.render();
      }
    });

    // Pointer up / cancel
    const finishInteraction = (e) => {
      if (e) {
        this.activePointers.delete(e.pointerId);
        el.releasePointerCapture?.(e.pointerId);
      }

      if (this.activePointers.size === 0) {
        this.initialPinchDistance = null;
        this.initialPinchZoom = null;
      }

      if (this.isPanning) {
        this.isPanning = false;
        this.dragStartScreenPos = null;
        this.updateCursor();
        return;
      }

      if (this.isMovingGuide) {
        this.isMovingGuide = false;
        this.dragStartScreenPos = null;
        return;
      }

      if (this.isDrawing) {
        this.isDrawing = false;

        // Apply shape preview to grid
        if (this.previewPixels && this.previewPixels.length > 0) {
          const color = this.paletteManager.activeColor;
          for (const pt of this.previewPixels) {
            if (pt.x >= 0 && pt.x < this.width && pt.y >= 0 && pt.y < this.height) {
              this.setPixel(pt.x, pt.y, color, false);
            }
          }
          this.previewPixels = null;
        }

        // Commit stroke to history
        this.historyManager.pushState(this.grid, this.width, this.height, `${this.activeTool} stroke`);
        this.saveAutosave();
        if (this.onStateChange) this.onStateChange();
        this.render();
      }
    };

    el.addEventListener('pointerup', finishInteraction);
    el.addEventListener('pointercancel', finishInteraction);
    el.addEventListener('pointerleave', () => {
      this.hoverGridPos = null;
      if (this.onPixelHover) this.onPixelHover(null);
      this.render();
    });

    // Wheel zoom & pan (Support macOS trackpad pinch and two-finger scroll)
    el.addEventListener('wheel', (e) => {
      e.preventDefault();

      if (e.ctrlKey) {
        // Trackpad pinch gesture on macOS Safari
        const zoomDelta = -e.deltaY * 0.02;
        const targetZoom = this.zoom * (1 + zoomDelta);
        const rect = this.container.getBoundingClientRect();
        this.setZoom(targetZoom, e.clientX - rect.left, e.clientY - rect.top);
      } else if (e.shiftKey) {
        // Shift + wheel = horizontal pan
        this.panX -= e.deltaY;
        this.render();
      } else if (Math.abs(e.deltaX) > 0 || (e.altKey && Math.abs(e.deltaY) > 0)) {
        // Two-finger trackpad pan
        this.panX -= e.deltaX;
        this.panY -= e.deltaY;
        this.render();
      } else {
        // Regular wheel zoom
        const zoomFactor = e.deltaY < 0 ? 1.2 : 0.833;
        const rect = this.container.getBoundingClientRect();
        this.setZoom(this.zoom * zoomFactor, e.clientX - rect.left, e.clientY - rect.top);
      }
    }, { passive: false });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space' && !this.isSpacePressed) {
        this.isSpacePressed = true;
        this.canvas.style.cursor = 'grab';
      }

      // Undo / Redo
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        this.undo();
      } else if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        this.redo();
      }

      // Tool shortcuts
      const key = e.key.toLowerCase();
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        if (key === 'b') this.setTool('pencil');
        if (key === 'e') this.setTool('eraser');
        if (key === 'g') this.setTool('bucket');
        if (key === 'i') this.setTool('eyedropper');
        if (key === 'l') this.setTool('line');
        if (key === 'u') this.setTool('rect');
        if (key === 'c') this.setTool('circle');
        if (key === 'h') this.setTool('pan');
        if (key === 'v') this.setTool('move-guide');
        if (key === '+') this.setZoom(this.zoom * 1.25);
        if (key === '-') this.setZoom(this.zoom * 0.8);
        if (key === '0') this.centerGridInView();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.isSpacePressed = false;
        this.updateCursor();
      }
    });
  }

  setTool(tool) {
    this.activeTool = tool;
    this.previewPixels = null;
    this.updateCursor();
    if (this.onStateChange) this.onStateChange();
    this.render();
  }

  updateCursor() {
    if (this.activeTool === 'pan' || this.isSpacePressed) {
      this.canvas.style.cursor = this.isPanning ? 'grabbing' : 'grab';
    } else if (this.activeTool === 'move-guide') {
      this.canvas.style.cursor = 'move';
    } else if (this.activeTool === 'eyedropper') {
      this.canvas.style.cursor = 'crosshair';
    } else {
      this.canvas.style.cursor = 'crosshair';
    }
  }

  setPixel(x, y, color, recordHistory = true) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.grid[y][x] = color;
  }

  getPixel(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return this.grid[y][x];
  }

  pickColorAt(x, y) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      const drawnColor = this.grid[y][x];
      if (drawnColor) {
        this.paletteManager.setActiveColor(drawnColor);
        if (this.onColorPicked) this.onColorPicked(drawnColor);
        this.setTool('pencil');
        return;
      }
    }

    // If pixel is empty and guide image exists, sample from guide
    if (this.guideImage && this.guideVisible) {
      const sampleColor = this.sampleGuideImageColor(x, y);
      if (sampleColor) {
        this.paletteManager.setActiveColor(sampleColor);
        if (this.onColorPicked) this.onColorPicked(sampleColor);
        this.setTool('pencil');
      }
    }
  }

  sampleGuideImageColor(gridX, gridY) {
    if (!this.guideImage) return null;
    const guideScale = this.guideScalePercent / 100;
    const imgX = (gridX - this.guideOffsetX) / guideScale;
    const imgY = (gridY - this.guideOffsetY) / guideScale;

    if (imgX < 0 || imgX >= this.guideImage.width || imgY < 0 || imgY >= this.guideImage.height) {
      return null;
    }

    const off = document.createElement('canvas');
    off.width = 1;
    off.height = 1;
    const ctx = off.getContext('2d');
    ctx.drawImage(this.guideImage, -Math.floor(imgX), -Math.floor(imgY));
    const p = ctx.getImageData(0, 0, 1, 1).data;
    if (p[3] === 0) return null;

    const hex = '#' + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1);
    return hex;
  }

  applyBucketFill(startX, startY) {
    const targetColor = this.paletteManager.activeColor;
    const changes = PixelAlgorithms.floodFill(this.grid, startX, startY, targetColor, this.width, this.height);
    if (changes.length > 0) {
      for (const c of changes) {
        this.grid[c.y][c.x] = targetColor;
      }
      this.historyManager.pushState(this.grid, this.width, this.height, 'Paint Bucket Fill');
      this.saveAutosave();
      if (this.onStateChange) this.onStateChange();
      this.render();
    }
  }

  updateShapePreview(currentX, currentY) {
    if (!this.dragStartGridPos) return;
    const x0 = this.dragStartGridPos.x;
    const y0 = this.dragStartGridPos.y;
    const x1 = currentX;
    const y1 = currentY;

    if (this.activeTool === 'line') {
      this.previewPixels = PixelAlgorithms.getLinePixels(x0, y0, x1, y1);
    } else if (this.activeTool === 'rect') {
      this.previewPixels = PixelAlgorithms.getRectPixels(x0, y0, x1, y1, false);
    } else if (this.activeTool === 'rect-fill') {
      this.previewPixels = PixelAlgorithms.getRectPixels(x0, y0, x1, y1, true);
    } else if (this.activeTool === 'circle') {
      this.previewPixels = PixelAlgorithms.getEllipsePixels(x0, y0, x1, y1, false);
    } else if (this.activeTool === 'circle-fill') {
      this.previewPixels = PixelAlgorithms.getEllipsePixels(x0, y0, x1, y1, true);
    }
  }

  undo() {
    const prevState = this.historyManager.undo();
    if (prevState) {
      this.width = prevState.width;
      this.height = prevState.height;
      this.grid = prevState.grid.map(row => [...row]);
      this.saveAutosave();
      if (this.onStateChange) this.onStateChange();
      this.render();
    }
  }

  redo() {
    const nextState = this.historyManager.redo();
    if (nextState) {
      this.width = nextState.width;
      this.height = nextState.height;
      this.grid = nextState.grid.map(row => [...row]);
      this.saveAutosave();
      if (this.onStateChange) this.onStateChange();
      this.render();
    }
  }

  saveAutosave() {
    StorageManager.saveToLocalStorage(this);
  }

  /**
   * Guide image operations
   */
  setGuideImage(img) {
    this.guideImage = img;
    this.guideVisible = true;
    // Calculate best fit scale percentage to fit nicely in grid by default
    const scaleX = this.width / (img.naturalWidth || img.width);
    const scaleY = this.height / (img.naturalHeight || img.height);
    const fitScale = Math.min(scaleX, scaleY);
    // If fit scale is reasonably close to 100%, or smaller than 100%, set fit scale; else default to 100%
    const defaultPct = Math.max(5, Math.min(100, Math.round(fitScale * 100)));
    this.guideScalePercent = defaultPct;
    this.centerGuideImage(false);

    if (this.onStateChange) this.onStateChange();
    this.render();
  }

  setGuideScalePercent(newScalePercent, keepCenter = true) {
    newScalePercent = Math.max(1, Math.min(5000, Math.round(Number(newScalePercent)) || 100));
    if (this.guideImage && keepCenter) {
      const oldScale = this.guideScalePercent / 100;
      const newScale = newScalePercent / 100;
      const currentCenterX = this.guideOffsetX + ((this.guideImage.naturalWidth || this.guideImage.width) * oldScale) / 2;
      const currentCenterY = this.guideOffsetY + ((this.guideImage.naturalHeight || this.guideImage.height) * oldScale) / 2;

      this.guideScalePercent = newScalePercent;
      this.guideOffsetX = Math.round(currentCenterX - ((this.guideImage.naturalWidth || this.guideImage.width) * newScale) / 2);
      this.guideOffsetY = Math.round(currentCenterY - ((this.guideImage.naturalHeight || this.guideImage.height) * newScale) / 2);
    } else {
      this.guideScalePercent = newScalePercent;
    }

    if (this.onStateChange) this.onStateChange();
    this.render();
  }

  setGuideOffset(offsetX, offsetY) {
    this.guideOffsetX = Math.round(Number(offsetX) || 0);
    this.guideOffsetY = Math.round(Number(offsetY) || 0);
    if (this.onStateChange) this.onStateChange();
    this.render();
  }

  setGuideOpacity(opacity) {
    this.guideOpacity = Math.max(0, Math.min(1, Number(opacity) || 0.45));
    if (this.onStateChange) this.onStateChange();
    this.render();
  }

  centerGuideImage(notify = true) {
    if (!this.guideImage) return;
    const guideScale = this.guideScalePercent / 100;
    const gw = (this.guideImage.naturalWidth || this.guideImage.width) * guideScale;
    const gh = (this.guideImage.naturalHeight || this.guideImage.height) * guideScale;
    this.guideOffsetX = Math.round((this.width - gw) / 2);
    this.guideOffsetY = Math.round((this.height - gh) / 2);
    if (notify && this.onStateChange) this.onStateChange();
    this.render();
  }

  fitGuideToGrid() {
    if (!this.guideImage) return;
    const imgW = this.guideImage.naturalWidth || this.guideImage.width;
    const imgH = this.guideImage.naturalHeight || this.guideImage.height;
    const scaleX = this.width / imgW;
    const scaleY = this.height / imgH;
    const fitScale = Math.min(scaleX, scaleY);
    this.guideScalePercent = Math.max(1, Math.round(fitScale * 100));
    this.centerGuideImage(false);
    if (this.onStateChange) this.onStateChange();
    this.render();
  }

  clearGuideImage() {
    this.guideImage = null;
    this.guideVisible = false;
    this.guideScalePercent = 100;
    this.guideOffsetX = 0;
    this.guideOffsetY = 0;
    if (this.onStateChange) this.onStateChange();
    this.render();
  }

  updateGuideUI() {
    if (this.onStateChange) this.onStateChange();
  }

  /**
   * Main Render Loop (Crisp canvas rendering with guide overlay and pixel grid)
   */
  render() {
    const ctx = this.ctx;
    const dpr = this.dpr || 1;

    // Reset transform & clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#141619';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply high-DPI scaling
    ctx.scale(dpr, dpr);

    // Turn off smoothing for crisp pixel edges
    ctx.imageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;

    // Grid bounds in screen space
    const gridScreenX = this.panX;
    const gridScreenY = this.panY;
    const gridScreenW = this.width * this.zoom;
    const gridScreenH = this.height * this.zoom;

    // 1. Draw Checkerboard background for grid area
    ctx.save();
    ctx.beginPath();
    ctx.rect(gridScreenX, gridScreenY, gridScreenW, gridScreenH);
    ctx.clip();

    ctx.fillStyle = this.checkerPattern;
    ctx.fillRect(gridScreenX, gridScreenY, gridScreenW, gridScreenH);

    // 2. Draw Guide Image (overlapping behind or blended with drawing)
    if (this.guideImage && this.guideVisible) {
      ctx.save();
      ctx.globalAlpha = this.guideOpacity;
      const guideScale = this.guideScalePercent / 100;
      const gw = this.guideImage.width * guideScale * this.zoom;
      const gh = this.guideImage.height * guideScale * this.zoom;
      const gx = gridScreenX + this.guideOffsetX * this.zoom;
      const gy = gridScreenY + this.guideOffsetY * this.zoom;

      ctx.drawImage(this.guideImage, gx, gy, gw, gh);
      ctx.restore();
    }

    // 3. Draw Drawn Pixels
    const z = this.zoom;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const color = this.grid[y][x];
        if (color) {
          ctx.fillStyle = color;
          // Exact pixel boundaries
          ctx.fillRect(
            gridScreenX + x * z,
            gridScreenY + y * z,
            z,
            z
          );
        }
      }
    }

    // 4. Draw Shape Preview
    if (this.previewPixels && this.previewPixels.length > 0) {
      ctx.save();
      ctx.fillStyle = this.paletteManager.activeColor;
      ctx.globalAlpha = 0.85;
      for (const pt of this.previewPixels) {
        if (pt.x >= 0 && pt.x < this.width && pt.y >= 0 && pt.y < this.height) {
          ctx.fillRect(gridScreenX + pt.x * z, gridScreenY + pt.y * z, z, z);
        }
      }
      ctx.restore();
    }

    // 5. Draw Pixel Grid lines (when zoom >= 3.5px)
    if (this.showGridLines && this.zoom >= 3.5) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;

      // Vertical lines
      ctx.beginPath();
      for (let x = 0; x <= this.width; x++) {
        const lx = Math.round(gridScreenX + x * z) + 0.5;
        ctx.moveTo(lx, gridScreenY);
        ctx.lineTo(lx, gridScreenY + gridScreenH);
      }

      // Horizontal lines
      for (let y = 0; y <= this.height; y++) {
        const ly = Math.round(gridScreenY + y * z) + 0.5;
        ctx.moveTo(gridScreenX, ly);
        ctx.lineTo(gridScreenX + gridScreenW, ly);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 6. Draw Hover highlight cursor
    if (this.hoverGridPos && !this.isPanning && !this.isMovingGuide) {
      const hx = gridScreenX + this.hoverGridPos.x * z;
      const hy = gridScreenY + this.hoverGridPos.y * z;
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hx + 0.5, hy + 0.5, z - 1, z - 1);
      ctx.restore();
    }

    // End Grid Clip
    ctx.restore();

    // 7. Outer Grid Border
    ctx.save();
    ctx.strokeStyle = '#3d4450';
    ctx.lineWidth = 1;
    ctx.strokeRect(gridScreenX - 0.5, gridScreenY - 0.5, gridScreenW + 1, gridScreenH + 1);
    ctx.restore();
  }
}

window.PixelCanvas = PixelCanvas;

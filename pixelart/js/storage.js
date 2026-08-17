/**
 * Storage and Export Management
 * Handles JSON project saving/loading, PNG image exporting with scaling options,
 * and localStorage autosave.
 */

const StorageManager = {
  AUTOSAVE_KEY: 'pixelart_session_state',

  /**
   * Save current project state as downloadable JSON file
   */
  saveProjectFile(editor) {
    const data = {
      format: 'pixelart-project',
      version: 1.0,
      timestamp: Date.now(),
      width: editor.width,
      height: editor.height,
      grid: editor.grid,
      paletteManager: {
        activePaletteId: editor.paletteManager.activePaletteId,
        customPalettes: editor.paletteManager.customPalettes
      },
      guideImage: editor.guideImage ? {
        dataUrl: editor.guideImage.src,
        scalePercent: editor.guideScalePercent,
        offsetX: editor.guideOffsetX,
        offsetY: editor.guideOffsetY,
        opacity: editor.guideOpacity,
        visible: editor.guideVisible
      } : null
    };

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const filename = `pixelart_${editor.width}x${editor.height}_${new Date().toISOString().slice(0, 10)}.pixelart`;

    this.triggerDownload(blob, filename);
  },

  /**
   * Load project from JSON or .pixelart file
   */
  loadProjectFile(file, editor, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data || !data.width || !data.height || !data.grid) {
          throw new Error('Invalid pixel art project file structure');
        }

        // Restore custom palettes if available
        if (data.paletteManager) {
          editor.paletteManager.importPalettesData(data.paletteManager);
        }

        // Load grid and resize
        editor.loadGridData(data.grid, data.width, data.height);

        // Load guide image if present
        if (data.guideImage && data.guideImage.dataUrl) {
          const img = new Image();
          img.onload = () => {
            editor.guideImage = img;
            editor.guideScalePercent = data.guideImage.scalePercent || 100;
            editor.guideOffsetX = data.guideImage.offsetX || 0;
            editor.guideOffsetY = data.guideImage.offsetY || 0;
            editor.guideOpacity = data.guideImage.opacity !== undefined ? data.guideImage.opacity : 0.5;
            editor.guideVisible = data.guideImage.visible !== undefined ? data.guideImage.visible : true;
            editor.updateGuideUI();
            editor.render();
            if (callback) callback(null, data);
          };
          img.onerror = () => {
            if (callback) callback(null, data);
          };
          img.src = data.guideImage.dataUrl;
        } else {
          editor.clearGuideImage();
          if (callback) callback(null, data);
        }
      } catch (err) {
        console.error('Failed to parse project file', err);
        if (callback) callback(err);
      }
    };
    reader.readAsText(file);
  },

  /**
   * Export Grid to PNG image with selectable scale multiplier & background
   */
  exportPNG(editor, scale = 1, options = {}) {
    const {
      backgroundColor = null, // null for transparent
      includeGuide = false
    } = options;

    const outWidth = editor.width * scale;
    const outHeight = editor.height * scale;

    const offscreen = document.createElement('canvas');
    offscreen.width = outWidth;
    offscreen.height = outHeight;
    const ctx = offscreen.getContext('2d');

    // Turn off smoothing for crisp pixel scaling
    ctx.imageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;

    // Fill background if specified
    if (backgroundColor) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, outWidth, outHeight);
    }

    // Draw guide image if requested
    if (includeGuide && editor.guideImage && editor.guideVisible) {
      ctx.save();
      ctx.globalAlpha = editor.guideOpacity;
      const guideScale = editor.guideScalePercent / 100;
      const gw = editor.guideImage.width * guideScale * scale;
      const gh = editor.guideImage.height * guideScale * scale;
      const gx = editor.guideOffsetX * scale;
      const gy = editor.guideOffsetY * scale;
      ctx.drawImage(editor.guideImage, gx, gy, gw, gh);
      ctx.restore();
    }

    // Draw pixel art
    for (let y = 0; y < editor.height; y++) {
      for (let x = 0; x < editor.width; x++) {
        const color = editor.grid[y][x];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }

    offscreen.toBlob((blob) => {
      if (!blob) {
        console.error('Canvas toBlob failed');
        return;
      }
      const filename = `pixelart_${editor.width}x${editor.height}_${scale}x_${Date.now()}.png`;
      this.triggerDownload(blob, filename);
    }, 'image/png');
  },

  /**
   * Helper to trigger download in Safari & standard browsers
   */
  triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 200);
  },

  /**
   * Autosave to localStorage
   */
  saveToLocalStorage(editor) {
    try {
      const payload = {
        width: editor.width,
        height: editor.height,
        grid: editor.grid,
        timestamp: Date.now()
      };
      localStorage.setItem(this.AUTOSAVE_KEY, JSON.stringify(payload));
    } catch (e) {
      // LocalStorage quota might be exceeded if very large
      console.warn('Autosave quota exceeded or disabled', e);
    }
  },

  /**
   * Restore from localStorage
   */
  loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem(this.AUTOSAVE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Could not read autosave state', e);
    }
    return null;
  },

  clearLocalStorage() {
    try {
      localStorage.removeItem(this.AUTOSAVE_KEY);
    } catch (e) {
      console.warn('Could not clear autosave', e);
    }
  }
};

window.StorageManager = StorageManager;

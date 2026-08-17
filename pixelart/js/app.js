/**
 * PixelArt App Controller
 * Connects Canvas engine, Palette Manager, Toolbars, Modals, and Guide Overlay.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Palette Manager
  const paletteManager = window.paletteManager;

  // Initialize Canvas with 125x125 default
  const editor = new PixelCanvas('canvas-viewport-container', {
    width: 125,
    height: 125
  });
  window.pixelEditor = editor;

  // Attempt to restore autosaved session if exists
  const autosaved = StorageManager.loadFromLocalStorage();
  if (autosaved && autosaved.grid && autosaved.width && autosaved.height) {
    editor.loadGridData(autosaved.grid, autosaved.width, autosaved.height);
  }

  // DOM Elements - Header
  const dimensionBadge = document.getElementById('dimension-badge');
  const dimensionLabel = document.getElementById('dimension-label');
  const clearBtn = document.getElementById('btn-clear');
  const saveBtn = document.getElementById('btn-save');
  const loadBtn = document.getElementById('btn-load');
  const loadFileInput = document.getElementById('file-input-load');
  const exportBtn = document.getElementById('btn-export');

  // DOM Elements - Sidebar Tabs & Toggle
  const tabPalettes = document.getElementById('tab-palettes');
  const tabGuide = document.getElementById('tab-guide');
  const panelPalettes = document.getElementById('panel-palettes');
  const panelGuide = document.getElementById('panel-guide');
  const mobileSidebarToggle = document.getElementById('mobile-sidebar-toggle');
  const appSidebar = document.getElementById('app-sidebar');

  // DOM Elements - Palettes
  const paletteSelect = document.getElementById('palette-select');
  const newPaletteBtn = document.getElementById('btn-new-palette');
  const activeColorBox = document.getElementById('active-color-box');
  const activeColorPicker = document.getElementById('active-color-picker');
  const activeColorHex = document.getElementById('active-color-hex');
  const addColorBtn = document.getElementById('btn-add-color');
  const paletteSwatchesGrid = document.getElementById('palette-swatches-grid');
  const recentSwatchesGrid = document.getElementById('recent-swatches-grid');

  // DOM Elements - Guide Image
  const guideFileInput = document.getElementById('file-input-guide');
  const guideLoadBtn = document.getElementById('btn-load-guide');
  const guideCard = document.getElementById('guide-preview-card');
  const guideThumb = document.getElementById('guide-thumb');
  const guideName = document.getElementById('guide-name');
  const guideMeta = document.getElementById('guide-meta');
  const guideVisibleCheck = document.getElementById('guide-visible-check');
  const guideOpacitySlider = document.getElementById('guide-opacity-slider');
  const guideOpacityVal = document.getElementById('guide-opacity-val');
  const guideScaleInput = document.getElementById('guide-scale-input');
  const guideScaleSlider = document.getElementById('guide-scale-slider');
  const guideScaleMinus = document.getElementById('guide-scale-minus');
  const guideScalePlus = document.getElementById('guide-scale-plus');
  const guidePosXInput = document.getElementById('guide-pos-x');
  const guidePosYInput = document.getElementById('guide-pos-y');
  const guideCenterBtn = document.getElementById('btn-guide-center');
  const guideFitBtn = document.getElementById('btn-guide-fit');
  const guideMoveToolBtn = document.getElementById('btn-guide-move-tool');
  const guideClearBtn = document.getElementById('btn-guide-clear');

  // DOM Elements - Modals
  const resizeModal = document.getElementById('modal-resize');
  const resizeWInput = document.getElementById('resize-width');
  const resizeHInput = document.getElementById('resize-height');
  const resizeApplyBtn = document.getElementById('btn-resize-apply');

  const exportModal = document.getElementById('modal-export');
  const exportScaleSelect = document.getElementById('export-scale-select');
  const exportBgSelect = document.getElementById('export-bg-select');
  const exportIncludeGuide = document.getElementById('export-include-guide');
  const exportConfirmBtn = document.getElementById('btn-export-confirm');

  const clearModal = document.getElementById('modal-clear');
  const clearConfirmBtn = document.getElementById('btn-clear-confirm');

  const newPaletteModal = document.getElementById('modal-new-palette');
  const newPaletteNameInput = document.getElementById('new-palette-name');
  const newPaletteCreateBtn = document.getElementById('btn-create-palette-confirm');

  // DOM Elements - Footer Status
  const statusCoords = document.getElementById('status-coords');
  const statusSize = document.getElementById('status-size');
  const statusZoom = document.getElementById('status-zoom');
  const statusTool = document.getElementById('status-tool');

  // Viewport Floating Controls
  const floatingZoomIn = document.getElementById('floating-zoom-in');
  const floatingZoomOut = document.getElementById('floating-zoom-out');
  const floatingZoomReset = document.getElementById('floating-zoom-reset');
  const floatingZoomLabel = document.getElementById('floating-zoom-label');

  // =========================================================================
  // UI Update Functions
  // =========================================================================

  function updateDimensionsUI() {
    const text = `${editor.width} × ${editor.height}`;
    if (dimensionLabel) dimensionLabel.textContent = text;
    if (statusSize) statusSize.textContent = `${editor.width} × ${editor.height} px`;
  }

  function updatePaletteDropdown() {
    if (!paletteSelect) return;
    paletteSelect.innerHTML = '';
    const palettes = paletteManager.getAllPalettes();

    palettes.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.colors.length}c)`;
      if (p.id === paletteManager.activePaletteId) {
        opt.selected = true;
      }
      paletteSelect.appendChild(opt);
    });
  }

  function updateSwatches() {
    if (!paletteSwatchesGrid) return;
    paletteSwatchesGrid.innerHTML = '';

    const activePal = paletteManager.getActivePalette();
    if (!activePal) return;

    activePal.colors.forEach((c) => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch' + (c.toLowerCase() === paletteManager.activeColor.toLowerCase() ? ' active' : '');
      swatch.style.backgroundColor = c;
      swatch.title = c;

      swatch.addEventListener('click', () => {
        paletteManager.setActiveColor(c);
        if (editor.activeTool === 'eraser') {
          editor.setTool('pencil');
        }
      });

      // Context menu to delete if custom palette
      if (activePal.isCustom) {
        swatch.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          if (confirm(`Remove color ${c} from palette "${activePal.name}"?`)) {
            paletteManager.removeColorFromPalette(activePal.id, c);
          }
        });
      }

      paletteSwatchesGrid.appendChild(swatch);
    });

    // Recent colors
    if (recentSwatchesGrid) {
      recentSwatchesGrid.innerHTML = '';
      paletteManager.recentColors.forEach(c => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = c;
        swatch.title = c;
        swatch.addEventListener('click', () => {
          paletteManager.setActiveColor(c);
        });
        recentSwatchesGrid.appendChild(swatch);
      });
    }

    // Update active color displays
    if (activeColorBox) activeColorBox.style.backgroundColor = paletteManager.activeColor;
    if (activeColorPicker) activeColorPicker.value = paletteManager.activeColor;
    if (activeColorHex) activeColorHex.value = paletteManager.activeColor.toUpperCase();
  }

  function updateGuidePanelUI() {
    const hasGuide = !!editor.guideImage;

    // Toggle Disabled state for all guide adjustment controls
    if (guideCard) guideCard.style.display = hasGuide ? 'flex' : 'none';
    if (guideVisibleCheck) guideVisibleCheck.disabled = !hasGuide;
    if (guideOpacitySlider) guideOpacitySlider.disabled = !hasGuide;
    if (guideScaleInput) guideScaleInput.disabled = !hasGuide;
    if (guideScaleSlider) guideScaleSlider.disabled = !hasGuide;
    if (guideScaleMinus) guideScaleMinus.disabled = !hasGuide;
    if (guideScalePlus) guideScalePlus.disabled = !hasGuide;
    if (guidePosXInput) guidePosXInput.disabled = !hasGuide;
    if (guidePosYInput) guidePosYInput.disabled = !hasGuide;
    if (guideCenterBtn) guideCenterBtn.disabled = !hasGuide;
    if (guideFitBtn) guideFitBtn.disabled = !hasGuide;
    if (guideMoveToolBtn) guideMoveToolBtn.disabled = !hasGuide;
    if (guideClearBtn) guideClearBtn.disabled = !hasGuide;

    document.querySelectorAll('.guide-scale-preset').forEach(btn => {
      btn.disabled = !hasGuide;
    });

    if (!hasGuide) {
      if (guideThumb) guideThumb.src = '';
      if (guideName) guideName.textContent = '';
      if (guideMeta) guideMeta.textContent = '';
      return;
    }

    // Populate values
    if (guideThumb && editor.guideImage.src) {
      guideThumb.src = editor.guideImage.src;
    }
    if (guideMeta) {
      const origW = editor.guideImage.naturalWidth || editor.guideImage.width;
      const origH = editor.guideImage.naturalHeight || editor.guideImage.height;
      guideMeta.textContent = `${origW} × ${origH} px (${editor.guideScalePercent}%)`;
    }

    if (guideVisibleCheck) {
      guideVisibleCheck.checked = editor.guideVisible;
    }

    if (guideOpacitySlider) {
      const pct = Math.round(editor.guideOpacity * 100);
      guideOpacitySlider.value = pct;
      if (guideOpacityVal) guideOpacityVal.textContent = `${pct}%`;
    }

    if (guideScaleInput) {
      guideScaleInput.value = editor.guideScalePercent;
    }
    if (guideScaleSlider) {
      guideScaleSlider.value = Math.min(500, Math.max(1, editor.guideScalePercent));
    }

    if (guidePosXInput) {
      guidePosXInput.value = editor.guideOffsetX;
    }
    if (guidePosYInput) {
      guidePosYInput.value = editor.guideOffsetY;
    }

    if (guideMoveToolBtn) {
      if (editor.activeTool === 'move-guide') {
        guideMoveToolBtn.classList.add('btn-primary');
      } else {
        guideMoveToolBtn.classList.remove('btn-primary');
      }
    }
  }

  function updateToolbarActiveTool() {
    document.querySelectorAll('.tool-btn').forEach(btn => {
      const tool = btn.dataset.tool;
      if (tool) {
        if (tool === editor.activeTool) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
    });

    if (statusTool) {
      const toolNames = {
        'pencil': 'Pencil (B)',
        'eraser': 'Eraser (E)',
        'bucket': 'Paint Bucket (G)',
        'eyedropper': 'Eyedropper (I)',
        'line': 'Line (L)',
        'rect': 'Rectangle (U)',
        'rect-fill': 'Filled Rectangle',
        'circle': 'Circle (C)',
        'circle-fill': 'Filled Circle',
        'pan': 'Pan View (H / Space)',
        'move-guide': 'Move Guide (V)'
      };
      statusTool.textContent = toolNames[editor.activeTool] || editor.activeTool;
    }

    // Undo / Redo button enabled states
    const undoBtn = document.getElementById('tool-undo');
    const redoBtn = document.getElementById('tool-redo');
    if (undoBtn) undoBtn.disabled = !editor.historyManager.canUndo();
    if (redoBtn) redoBtn.disabled = !editor.historyManager.canRedo();
  }

  // =========================================================================
  // Canvas Callbacks
  // =========================================================================

  editor.onPixelHover = (pos) => {
    if (statusCoords) {
      if (pos) {
        statusCoords.textContent = `X: ${pos.x}, Y: ${pos.y}`;
      } else {
        statusCoords.textContent = `-- : --`;
      }
    }
  };

  editor.onViewportChange = ({ zoom }) => {
    if (statusZoom) statusZoom.textContent = `${Math.round(zoom * 100)}% (${zoom.toFixed(1)}x)`;
    if (floatingZoomLabel) floatingZoomLabel.textContent = `${Math.round(zoom * 100)}%`;
  };

  editor.onStateChange = () => {
    updateDimensionsUI();
    updateToolbarActiveTool();
    updateGuidePanelUI();
  };

  paletteManager.subscribe(() => {
    updatePaletteDropdown();
    updateSwatches();
  });

  // =========================================================================
  // Header Actions
  // =========================================================================

  // Resize Modal
  if (dimensionBadge) {
    dimensionBadge.addEventListener('click', () => {
      if (resizeWInput) resizeWInput.value = editor.width;
      if (resizeHInput) resizeHInput.value = editor.height;
      openModal(resizeModal);
    });
  }

  if (resizeApplyBtn) {
    resizeApplyBtn.addEventListener('click', () => {
      const w = parseInt(resizeWInput.value, 10);
      const h = parseInt(resizeHInput.value, 10);
      if (w > 0 && h > 0) {
        editor.setDimensions(w, h);
        closeModal(resizeModal);
      }
    });
  }

  // Preset buttons in resize modal
  document.querySelectorAll('.preset-btn[data-size]').forEach(btn => {
    btn.addEventListener('click', () => {
      const size = parseInt(btn.dataset.size, 10);
      if (size && resizeWInput && resizeHInput) {
        resizeWInput.value = size;
        resizeHInput.value = size;
      }
    });
  });

  // Clear Drawing
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      openModal(clearModal);
    });
  }

  if (clearConfirmBtn) {
    clearConfirmBtn.addEventListener('click', () => {
      editor.clearDrawing();
      closeModal(clearModal);
    });
  }

  // Save Project
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      StorageManager.saveProjectFile(editor);
    });
  }

  // Load Project
  if (loadBtn && loadFileInput) {
    loadBtn.addEventListener('click', () => {
      loadFileInput.click();
    });

    loadFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        StorageManager.loadProjectFile(file, editor, (err) => {
          if (err) {
            alert('Failed to load file: ' + err.message);
          }
          loadFileInput.value = '';
        });
      }
    });
  }

  // Export Modal & Confirmation
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      openModal(exportModal);
    });
  }

  if (exportConfirmBtn) {
    exportConfirmBtn.addEventListener('click', () => {
      const scale = parseInt(exportScaleSelect.value, 10) || 1;
      const bgChoice = exportBgSelect.value;
      let bg = null;
      if (bgChoice === 'black') bg = '#000000';
      if (bgChoice === 'white') bg = '#ffffff';

      const includeGuide = exportIncludeGuide.checked;

      StorageManager.exportPNG(editor, scale, {
        backgroundColor: bg,
        includeGuide
      });
      closeModal(exportModal);
    });
  }

  // =========================================================================
  // Toolbar Buttons
  // =========================================================================

  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      const action = btn.dataset.action;

      if (tool) {
        editor.setTool(tool);
        updateToolbarActiveTool();
      }

      if (action === 'undo') {
        editor.undo();
      } else if (action === 'redo') {
        editor.redo();
      } else if (action === 'toggle-grid') {
        editor.showGridLines = !editor.showGridLines;
        btn.classList.toggle('active', editor.showGridLines);
        editor.render();
      } else if (action === 'zoom-in') {
        editor.setZoom(editor.zoom * 1.3);
      } else if (action === 'zoom-out') {
        editor.setZoom(editor.zoom * 0.77);
      } else if (action === 'zoom-reset') {
        editor.centerGridInView();
      }
    });
  });

  // Floating Zoom Controls
  if (floatingZoomIn) {
    floatingZoomIn.addEventListener('click', () => editor.setZoom(editor.zoom * 1.3));
  }
  if (floatingZoomOut) {
    floatingZoomOut.addEventListener('click', () => editor.setZoom(editor.zoom * 0.77));
  }
  if (floatingZoomReset) {
    floatingZoomReset.addEventListener('click', () => editor.centerGridInView());
  }

  // =========================================================================
  // Palette Controls
  // =========================================================================

  if (paletteSelect) {
    paletteSelect.addEventListener('change', (e) => {
      paletteManager.setActivePalette(e.target.value);
    });
  }

  if (activeColorPicker) {
    activeColorPicker.addEventListener('input', (e) => {
      paletteManager.setActiveColor(e.target.value);
    });
  }

  if (activeColorHex) {
    activeColorHex.addEventListener('change', (e) => {
      let val = e.target.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9A-Fa-f]{6}$/.test(val) || /^#[0-9A-Fa-f]{3}$/.test(val)) {
        paletteManager.setActiveColor(val);
      }
    });
  }

  if (addColorBtn) {
    addColorBtn.addEventListener('click', () => {
      paletteManager.addColorToActivePalette(paletteManager.activeColor);
    });
  }

  // New Palette Modal
  if (newPaletteBtn) {
    newPaletteBtn.addEventListener('click', () => {
      if (newPaletteNameInput) newPaletteNameInput.value = '';
      openModal(newPaletteModal);
    });
  }

  if (newPaletteCreateBtn) {
    newPaletteCreateBtn.addEventListener('click', () => {
      const name = newPaletteNameInput.value.trim();
      paletteManager.createPalette(name);
      closeModal(newPaletteModal);
    });
  }

  // =========================================================================
  // Guide / Reference Image Controls
  // =========================================================================

  if (guideLoadBtn && guideFileInput) {
    guideLoadBtn.addEventListener('click', () => {
      guideFileInput.click();
    });

    guideFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            if (guideName) guideName.textContent = file.name;
            editor.setGuideImage(img);
            // Switch tab to guide so user sees controls immediately
            switchSidebarTab('guide');
            updateGuidePanelUI();
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
      // Reset input value so reloading the same file fires change
      guideFileInput.value = '';
    });
  }

  if (guideVisibleCheck) {
    guideVisibleCheck.addEventListener('change', (e) => {
      editor.guideVisible = e.target.checked;
      editor.render();
    });
  }

  if (guideOpacitySlider) {
    guideOpacitySlider.addEventListener('input', (e) => {
      editor.setGuideOpacity(parseInt(e.target.value, 10) / 100);
      if (guideOpacityVal) guideOpacityVal.textContent = `${e.target.value}%`;
    });
  }

  function handleScaleChange(val) {
    const num = Math.max(1, Math.min(5000, parseInt(val, 10) || 100));
    editor.setGuideScalePercent(num, true);
    if (guideScaleInput) guideScaleInput.value = num;
    if (guideScaleSlider) guideScaleSlider.value = Math.min(500, num);
  }

  if (guideScaleInput) {
    guideScaleInput.addEventListener('input', (e) => handleScaleChange(e.target.value));
    guideScaleInput.addEventListener('change', (e) => handleScaleChange(e.target.value));
  }

  if (guideScaleSlider) {
    guideScaleSlider.addEventListener('input', (e) => {
      const num = parseInt(e.target.value, 10);
      editor.setGuideScalePercent(num, true);
      if (guideScaleInput) guideScaleInput.value = num;
    });
  }

  if (guideScaleMinus) {
    guideScaleMinus.addEventListener('click', () => {
      const current = editor.guideScalePercent;
      const step = current > 100 ? 25 : (current > 20 ? 10 : 5);
      const next = Math.max(1, current - step);
      editor.setGuideScalePercent(next, true);
      if (guideScaleInput) guideScaleInput.value = next;
      if (guideScaleSlider) guideScaleSlider.value = Math.min(500, next);
    });
  }

  if (guideScalePlus) {
    guideScalePlus.addEventListener('click', () => {
      const current = editor.guideScalePercent;
      const step = current >= 100 ? 25 : 10;
      const next = Math.min(5000, current + step);
      editor.setGuideScalePercent(next, true);
      if (guideScaleInput) guideScaleInput.value = next;
      if (guideScaleSlider) guideScaleSlider.value = Math.min(500, next);
    });
  }

  // Guide scale quick presets
  document.querySelectorAll('.guide-scale-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const scale = parseInt(btn.dataset.scale, 10);
      if (scale) {
        editor.setGuideScalePercent(scale, true);
        if (guideScaleInput) guideScaleInput.value = scale;
        if (guideScaleSlider) guideScaleSlider.value = Math.min(500, scale);
      }
    });
  });

  if (guidePosXInput) {
    guidePosXInput.addEventListener('input', (e) => {
      editor.setGuideOffset(parseInt(e.target.value, 10) || 0, editor.guideOffsetY);
    });
    guidePosXInput.addEventListener('change', (e) => {
      editor.setGuideOffset(parseInt(e.target.value, 10) || 0, editor.guideOffsetY);
    });
  }

  if (guidePosYInput) {
    guidePosYInput.addEventListener('input', (e) => {
      editor.setGuideOffset(editor.guideOffsetX, parseInt(e.target.value, 10) || 0);
    });
    guidePosYInput.addEventListener('change', (e) => {
      editor.setGuideOffset(editor.guideOffsetX, parseInt(e.target.value, 10) || 0);
    });
  }

  if (guideCenterBtn) {
    guideCenterBtn.addEventListener('click', () => {
      editor.centerGuideImage(true);
      if (guidePosXInput) guidePosXInput.value = editor.guideOffsetX;
      if (guidePosYInput) guidePosYInput.value = editor.guideOffsetY;
    });
  }

  if (guideFitBtn) {
    guideFitBtn.addEventListener('click', () => {
      editor.fitGuideToGrid();
      if (guideScaleInput) guideScaleInput.value = editor.guideScalePercent;
      if (guideScaleSlider) guideScaleSlider.value = Math.min(500, editor.guideScalePercent);
      if (guidePosXInput) guidePosXInput.value = editor.guideOffsetX;
      if (guidePosYInput) guidePosYInput.value = editor.guideOffsetY;
    });
  }

  if (guideMoveToolBtn) {
    guideMoveToolBtn.addEventListener('click', () => {
      if (editor.activeTool === 'move-guide') {
        editor.setTool('pencil');
      } else {
        editor.setTool('move-guide');
      }
      updateToolbarActiveTool();
    });
  }

  if (guideClearBtn) {
    guideClearBtn.addEventListener('click', () => {
      editor.clearGuideImage();
      if (guideName) guideName.textContent = '';
      if (guideThumb) guideThumb.src = '';
      if (guideFileInput) guideFileInput.value = '';
      if (editor.activeTool === 'move-guide') {
        editor.setTool('pencil');
      }
      updateGuidePanelUI();
    });
  }

  // =========================================================================
  // Sidebar Tabs & Mobile Responsive Drawer
  // =========================================================================

  function switchSidebarTab(tabName) {
    if (tabName === 'palettes') {
      tabPalettes.classList.add('active');
      tabGuide.classList.remove('active');
      panelPalettes.classList.add('active');
      panelGuide.classList.remove('active');
    } else {
      tabGuide.classList.add('active');
      tabPalettes.classList.remove('active');
      panelGuide.classList.add('active');
      panelPalettes.classList.remove('active');
    }
  }

  if (tabPalettes) tabPalettes.addEventListener('click', () => switchSidebarTab('palettes'));
  if (tabGuide) tabGuide.addEventListener('click', () => switchSidebarTab('guide'));

  if (mobileSidebarToggle) {
    mobileSidebarToggle.addEventListener('click', () => {
      appSidebar.classList.toggle('mobile-open');
    });
  }

  // =========================================================================
  // Modal Helpers
  // =========================================================================

  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add('open');
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('open');
  }

  document.querySelectorAll('.modal-close-btn, .btn-modal-cancel').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-overlay');
      closeModal(modal);
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay);
      }
    });
  });

  // Initial Sync
  updateDimensionsUI();
  updatePaletteDropdown();
  updateSwatches();
  updateToolbarActiveTool();
  updateGuidePanelUI();
});

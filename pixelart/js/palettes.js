/**
 * Retro Palettes and Palette Management
 * Specializing in authentic late-1980s consoles, home computers, and arcade systems.
 */

const RETRO_PALETTES = [
  {
    id: 'nes-classic',
    name: 'NES / Famicom (Late 80s)',
    system: 'Nintendo Entertainment System (1983-1989)',
    colors: [
      '#000000', '#7C7C7C', '#0000FC', '#0000BC', '#4428BC', '#940084', '#A80020', '#A81000',
      '#881400', '#503000', '#007800', '#006800', '#005800', '#004058', '#BCBCBC', '#0078F8',
      '#0058F8', '#6844FC', '#D800CC', '#E40058', '#F83800', '#E45C10', '#AC7C00', '#00B800',
      '#00A800', '#00A844', '#008888', '#F8F8F8', '#3CBCFC', '#6888FC', '#9878F8', '#F878F8',
      '#F85898', '#F87858', '#FCA044', '#F8B800', '#B8F818', '#58D854', '#58F898', '#00E8D8',
      '#787878', '#FCFCFC', '#A4E4FC', '#B8B8F8', '#D8B8F8', '#F8B8F8', '#F8A4C0', '#F0D0B0',
      '#FCE0A8', '#F8D878', '#D8F878', '#B8F8B8', '#B8F8D8', '#00FCFC', '#F8D8F8', '#202020'
    ]
  },
  {
    id: 'c64',
    name: 'Commodore 64 (VIC-II)',
    system: 'Commodore 64 (1982-1990s)',
    colors: [
      '#000000', '#FFFFFF', '#880000', '#AAFFEE', '#CC44CC', '#00CC55', '#0000AA', '#EEEE77',
      '#DD8855', '#664400', '#FF7777', '#333333', '#777777', '#AAFF66', '#0088FF', '#BBBBBB'
    ]
  },
  {
    id: 'sega-master',
    name: 'Sega Master System / Mark III',
    system: 'Sega Master System (1986-1989)',
    colors: [
      '#000000', '#000055', '#0000AA', '#0000FF', '#005500', '#005555', '#0055AA', '#0055FF',
      '#00AA00', '#00AA55', '#00AAAA', '#00AAFF', '#00FF00', '#00FF55', '#00FFAA', '#00FFFF',
      '#550000', '#550055', '#5500AA', '#5500FF', '#555500', '#555555', '#5555AA', '#5555FF',
      '#55AA00', '#55AA55', '#55AAAA', '#55AAFF', '#55FF00', '#55FF55', '#55FFAA', '#55FFFF',
      '#AA0000', '#AA0055', '#AA00AA', '#AA00FF', '#AA5500', '#AA5555', '#AA55AA', '#AA55FF',
      '#AAAA00', '#AAAA55', '#AAAAAA', '#AAAAFF', '#AAFF00', '#AAFF55', '#AAFFAA', '#AAFFFF',
      '#FF0000', '#FF0055', '#FF00AA', '#FF00FF', '#FF5500', '#FF5555', '#FF55AA', '#FF55FF',
      '#FFAA00', '#FFAA55', '#FFAAAA', '#FFAAFF', '#FFFF00', '#FFFF55', '#FFFFAA', '#FFFFFF'
    ]
  },
  {
    id: 'amiga-ocs',
    name: 'Amiga OCS 32 Classic',
    system: 'Commodore Amiga (1985-1990)',
    colors: [
      '#000000', '#001122', '#002255', '#004488', '#0077BB', '#00AADD', '#55CCEE', '#FFFFFF',
      '#220000', '#551100', '#882200', '#BB4400', '#EE7700', '#FFAA00', '#FFDD33', '#FFFF88',
      '#002200', '#004400', '#117711', '#33AA22', '#66CC44', '#99EE66', '#CCFFAA', '#443322',
      '#775533', '#AA7744', '#DD9966', '#221133', '#552266', '#883399', '#BB55CC', '#EE88EE'
    ]
  },
  {
    id: 'gameboy-1989',
    name: 'Game Boy DMG (1989)',
    system: 'Nintendo Game Boy (1989)',
    colors: [
      '#0f380f', '#306230', '#8bac0f', '#9bbc0f'
    ]
  },
  {
    id: 'ega-16',
    name: 'IBM PC EGA (16 Colors)',
    system: 'IBM PC Enhanced Graphics Adapter (1984-1989)',
    colors: [
      '#000000', '#0000AA', '#00AA00', '#00AAAA', '#AA0000', '#AA00AA', '#AA5500', '#AAAAAA',
      '#555555', '#5555FF', '#55FF55', '#55FFFF', '#FF5555', '#FF55FF', '#FFFF55', '#FFFFFF'
    ]
  },
  {
    id: 'zx-spectrum',
    name: 'ZX Spectrum (1982-1988)',
    system: 'Sinclair ZX Spectrum',
    colors: [
      '#000000', '#0000D7', '#D70000', '#D700D7', '#00D700', '#00D7D7', '#D7D700', '#D7D7D7',
      '#0000FF', '#FF0000', '#FF00FF', '#00FF00', '#00FFFF', '#FFFF00', '#FFFFFF'
    ]
  },
  {
    id: 'pico-8',
    name: 'PICO-8 Fantasy Console',
    system: 'Modern Retro 16-Color',
    colors: [
      '#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8',
      '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA'
    ]
  }
];

class PaletteManager {
  constructor() {
    this.palettes = [];
    this.customPalettes = [];
    this.activePaletteId = 'nes-classic';
    this.activeColor = '#000000';
    this.recentColors = [];
    this.maxRecent = 12;
    this.listeners = [];

    this.init();
  }

  init() {
    // Clone built-in palettes
    this.palettes = JSON.parse(JSON.stringify(RETRO_PALETTES));
    this.loadCustomPalettes();
    
    const activePal = this.getActivePalette();
    if (activePal && activePal.colors.length > 0) {
      this.activeColor = activePal.colors[0];
    }
  }

  loadCustomPalettes() {
    try {
      const saved = localStorage.getItem('pixelart_custom_palettes');
      if (saved) {
        this.customPalettes = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Could not load custom palettes from localStorage', e);
    }
  }

  saveCustomPalettes() {
    try {
      localStorage.setItem('pixelart_custom_palettes', JSON.stringify(this.customPalettes));
    } catch (e) {
      console.warn('Could not save custom palettes', e);
    }
  }

  getAllPalettes() {
    return [...this.palettes, ...this.customPalettes];
  }

  getActivePalette() {
    const all = this.getAllPalettes();
    return all.find(p => p.id === this.activePaletteId) || all[0];
  }

  setActivePalette(id) {
    this.activePaletteId = id;
    const active = this.getActivePalette();
    if (active && !active.colors.some(c => c.toLowerCase() === this.activeColor.toLowerCase())) {
      if (active.colors.length > 0) {
        this.activeColor = active.colors[0];
      }
    }
    this.notify();
  }

  setActiveColor(color) {
    if (!color) return;
    this.activeColor = color.toLowerCase();
    this.addRecentColor(this.activeColor);
    this.notify();
  }

  addRecentColor(color) {
    color = color.toLowerCase();
    this.recentColors = this.recentColors.filter(c => c !== color);
    this.recentColors.unshift(color);
    if (this.recentColors.length > this.maxRecent) {
      this.recentColors.pop();
    }
  }

  createPalette(name, initialColors = []) {
    const id = 'custom-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const newPal = {
      id,
      name: name || 'Custom Palette ' + (this.customPalettes.length + 1),
      system: 'User Created',
      isCustom: true,
      colors: initialColors.length > 0 ? initialColors : ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff']
    };
    this.customPalettes.push(newPal);
    this.saveCustomPalettes();
    this.setActivePalette(id);
    this.notify();
    return newPal;
  }

  deletePalette(id) {
    const idx = this.customPalettes.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.customPalettes.splice(idx, 1);
      this.saveCustomPalettes();
      if (this.activePaletteId === id) {
        this.activePaletteId = this.palettes[0].id;
      }
      this.notify();
    }
  }

  addColorToActivePalette(color) {
    const active = this.getActivePalette();
    if (!active) return;
    color = color.toLowerCase();
    if (!active.colors.some(c => c.toLowerCase() === color)) {
      if (!active.isCustom) {
        // If it's a built-in palette, create a custom copy
        const copy = this.createPalette(active.name + ' (Custom)', [...active.colors, color]);
        this.setActiveColor(color);
        return copy;
      } else {
        active.colors.push(color);
        this.saveCustomPalettes();
        this.notify();
      }
    }
  }

  removeColorFromPalette(paletteId, color) {
    const pal = this.customPalettes.find(p => p.id === paletteId);
    if (pal) {
      pal.colors = pal.colors.filter(c => c.toLowerCase() !== color.toLowerCase());
      this.saveCustomPalettes();
      this.notify();
    }
  }

  exportPalettesJSON() {
    return JSON.stringify({
      activePaletteId: this.activePaletteId,
      customPalettes: this.customPalettes
    }, null, 2);
  }

  importPalettesData(data) {
    if (data && Array.isArray(data.customPalettes)) {
      this.customPalettes = data.customPalettes;
      this.saveCustomPalettes();
    }
    if (data && data.activePaletteId) {
      this.setActivePalette(data.activePaletteId);
    }
    this.notify();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(fn => fn(this));
  }
}

// Global instance
window.paletteManager = new PaletteManager();

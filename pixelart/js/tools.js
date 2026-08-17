/**
 * Drawing Tools and History Management
 * Provides pixel algorithms (Bresenham line, circle, flood fill, shape previews)
 * and Undo/Redo history stack.
 */

class HistoryManager {
  constructor(maxStates = 40) {
    this.maxStates = maxStates;
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = [];
  }

  pushState(gridData, width, height, description = 'Draw') {
    // Clone 2D grid
    const copy = gridData.map(row => [...row]);
    this.undoStack.push({
      grid: copy,
      width,
      height,
      description,
      timestamp: Date.now()
    });

    if (this.undoStack.length > this.maxStates) {
      this.undoStack.shift();
    }
    // Clear redo on new action
    this.redoStack = [];
    this.notify();
  }

  canUndo() {
    return this.undoStack.length > 1;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    if (!this.canUndo()) return null;
    const current = this.undoStack.pop();
    this.redoStack.push(current);
    const prev = this.undoStack[this.undoStack.length - 1];
    this.notify();
    return prev;
  }

  redo() {
    if (!this.canRedo()) return null;
    const next = this.redoStack.pop();
    this.undoStack.push(next);
    this.notify();
    return next;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
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

// Geometric & Drawing Algorithms
const PixelAlgorithms = {
  /**
   * Bresenham's line algorithm between (x0, y0) and (x1, y1)
   */
  getLinePixels(x0, y0, x1, y1) {
    const points = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = (x0 < x1) ? 1 : -1;
    const sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;

    let currX = x0;
    let currY = y0;

    while (true) {
      points.push({ x: currX, y: currY });
      if (currX === x1 && currY === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        currX += sx;
      }
      if (e2 < dx) {
        err += dx;
        currY += sy;
      }
    }
    return points;
  },

  /**
   * Rectangle outline pixels between (x0, y0) and (x1, y1)
   */
  getRectPixels(x0, y0, x1, y1, filled = false) {
    const points = [];
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (filled || x === minX || x === maxX || y === minY || y === maxY) {
          points.push({ x, y });
        }
      }
    }
    return points;
  },

  /**
   * Midpoint Circle algorithm between center (x0, y0) and (x1, y1) bounding box
   */
  getEllipsePixels(x0, y0, x1, y1, filled = false) {
    const points = [];
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);

    const rx = (maxX - minX) / 2;
    const ry = (maxY - minY) / 2;
    const cx = minX + rx;
    const cy = minY + ry;

    if (rx <= 0 || ry <= 0) {
      return this.getRectPixels(x0, y0, x1, y1, filled);
    }

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const dist = dx * dx + dy * dy;

        if (filled) {
          if (dist <= 1.05) {
            points.push({ x, y });
          }
        } else {
          // Outline tolerance
          if (dist <= 1.15 && dist >= 0.65) {
            points.push({ x, y });
          }
        }
      }
    }
    return points;
  },

  /**
   * 4-Way Connected Flood Fill
   */
  floodFill(grid, startX, startY, targetColor, width, height) {
    if (startX < 0 || startX >= width || startY < 0 || startY >= height) return [];
    
    const sourceColor = grid[startY][startX];
    // If target is same as source, no-op
    if (sourceColor === targetColor) return [];

    const changedPixels = [];
    const queue = [{ x: startX, y: startY }];
    const visited = new Uint8Array(width * height);
    visited[startY * width + startX] = 1;

    while (queue.length > 0) {
      const { x, y } = queue.pop();
      changedPixels.push({ x, y, prevColor: grid[y][x], newColor: targetColor });

      const neighbors = [
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 }
      ];

      for (const n of neighbors) {
        if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
          const idx = n.y * width + n.x;
          if (!visited[idx]) {
            visited[idx] = 1;
            if (grid[n.y][n.x] === sourceColor) {
              queue.push(n);
            }
          }
        }
      }
    }

    return changedPixels;
  }
};

window.HistoryManager = HistoryManager;
window.PixelAlgorithms = PixelAlgorithms;

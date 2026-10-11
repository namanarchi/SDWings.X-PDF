/**
 * annotationCanvas.js
 * AnnotationManager: Central coordinator managing CAD markups, tools,
 * undo/redo history, selection state, and page canvas overlay bindings.
 */

import { showToast, closeAllPopovers } from './dialogManager.js';
import {
  getAnnotationBounds,
  getSelectionUIGeometry,
  hitTestSelectionUI,
  hitTestAnnotation,
  applyResize,
  computeCadMeasurement,
  findSnapCandidate
} from './annotations/annotationGeometry.js';
import {
  drawPageOverlay,
  createFinalAnnotation,
  getPreviewAnnotation
} from './annotations/annotationRenderer.js';
import {
  renderPropertyToolbar,
  syncPropertyToolbarValues,
  updatePropertyToolbarPosition,
  hidePropertyToolbar
} from './annotations/propertyToolbar.js';
import { startDirectInlineEdit } from './annotations/inlineEditor.js';

export class AnnotationManager {
  constructor() {
    this.annotationsByPage = new Map(); // pageIndex (0-based) -> array of annot objects
    this.currentTool = 'select'; // 'select' | 'pen' | 'highlight' | 'ruler' | 'text' | 'rect' | 'arrow' | 'cloud' | 'stamp' | 'signature'
    this.strokeColor = '#f5a623';
    this.strokeWidth = 2;
    this.highlighterColor = '#f5a623';
    this.activeStampText = 'APPROVED';
    this.activeStampColor = '#2e7d32';
    this.activeSignatureData = null;
    this.onRequestSignature = () => {};

    // Selection, Drag & Resize state
    this.selectedAnnot = null;
    this.selectedPageIndex = null;
    this.isDraggingSelected = false;
    this.dragStartCoords = { x: 0, y: 0 };
    this.dragOrigPos = null;

    this.isResizingSelected = false;
    this.resizeHandle = null;
    this.resizeStartPt = null;
    this.resizeOrigBounds = null;
    this.resizeOrigAnnot = null;

    this.isRotatingSelected = false;
    this.rotateCenter = null;
    this.rotateOrigRot = 0;

    // Floating Contextual Property Inspector Toolbar
    this.propertyToolbarEl = null;
    this.propertyToolbarAnnot = null;

    // CAD scale calibration
    this.scaleRatio = 100; // 1:100 scale default for architectural drawings
    this.unit = 'mm'; // 'mm' | 'm' | 'cm'

    this.history = []; // Undo stack
    this.redoStack = []; // Redo stack

    this.isDrawing = false;
    this.currentPath = null;
    this.activePage = 0;
    this.startPoint = null;
    this.currentPoint = null;

    this.activeSnap = null;
    this.lastPenPoint = null;
    this.shapeDraftPoints = null;

    this.onStateChange = () => {};

    // Keyboard shortcuts: Delete/Backspace for selection, Enter/Escape for shape draft
    window.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.isContentEditable) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedAnnot && this.selectedPageIndex !== null) {
          e.preventDefault();
          this.deleteSelectedAnnotation();
        }
      } else if (e.key === 'Enter') {
        if (this.shapeDraftPoints && this.shapeDraftPoints.length >= 2) {
          e.preventDefault();
          this.commitShapeDraft();
        }
      } else if (e.key === 'Escape') {
        if (this.shapeDraftPoints) {
          e.preventDefault();
          this.shapeDraftPoints = null;
          this.activeSnap = null;
          const overlayCanvas = document.querySelector(`.pdf-page-container[data-page-index="${this.activePage}"] .pdf-annotation-overlay`);
          if (overlayCanvas) this.drawPageOverlay(this.activePage, overlayCanvas);
        }
      }
    });
  }

  setTool(tool) {
    this.currentTool = tool;
    if (tool !== 'shape' && tool !== 'curve') {
      this.shapeDraftPoints = null;
      this.activeSnap = null;
    }
    if (tool !== 'select') {
      this.selectedAnnot = null;
      this.selectedPageIndex = null;
      this.hidePropertyToolbar();
      document.querySelectorAll('.pdf-annotation-overlay').forEach(el => el.style.pointerEvents = 'auto');
    } else {
      document.querySelectorAll('.pdf-annotation-overlay').forEach(el => el.style.pointerEvents = 'none');
    }
    this.onStateChange({ tool: this.currentTool });
  }

  setColor(color) {
    this.strokeColor = color;
  }

  setStrokeWidth(w) {
    this.strokeWidth = w;
  }

  setScaleRatio(ratio, unit = 'mm') {
    this.scaleRatio = ratio;
    this.unit = unit;
  }

  setStamp(text, color) {
    this.activeStampText = text;
    this.activeStampColor = color;
    this.setTool('stamp');
  }

  setSignatureData(dataUrl) {
    this.activeSignatureData = dataUrl;
    if (this.selectedAnnot && this.selectedAnnot.type === 'signature') {
      this.selectedAnnot.dataUrl = dataUrl;
      this.onStateChange({ dirty: true });
    } else {
      this.setTool('signature');
    }
  }

  addImageAnnotation(pageIndex, dataUrl, coords = null, widthNorm = 0.28) {
    if (!dataUrl) return;
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const natW = img.naturalWidth || 400;
      const natH = img.naturalHeight || 300;
      const ratio = natW / natH;

      const w = Math.min(0.65, Math.max(0.12, widthNorm));
      const h = Math.min(0.65, Math.max(0.08, (w / ratio) * 0.72));

      let x = coords ? (coords.x - w / 2) : (0.5 - w / 2);
      let y = coords ? (coords.y - h / 2) : (0.4 - h / 2);

      x = Math.max(0.02, Math.min(0.98 - w, x));
      y = Math.max(0.02, Math.min(0.98 - h, y));

      const annot = {
        id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'image',
        dataUrl,
        x,
        y,
        w,
        h,
        opacity: 1.0,
        color: 'transparent',
        size: 0,
        borderRadius: 0,
        lockAspectRatio: true,
        _cachedImg: img
      };

      if (!this.annotationsByPage.has(pageIndex)) {
        this.annotationsByPage.set(pageIndex, []);
      }
      this.annotationsByPage.get(pageIndex).push(annot);

      this.history.push({
        action: 'add',
        pageIndex,
        annot
      });
      this.redoStack = [];

      this.selectedAnnot = annot;
      this.selectedPageIndex = pageIndex;
      this.setTool('select');
      this.onStateChange({ dirty: true });

      const overlay = document.querySelector(`.pdf-annotation-overlay[data-overlay-page="${pageIndex + 1}"]`);
      if (overlay) {
        this.drawPageOverlay(pageIndex, overlay);
        this.renderPropertyToolbar(pageIndex, overlay);
      }
    };
  }

  getAnnotationsForPage(pageIndex) {
    return this.annotationsByPage.get(pageIndex) || [];
  }

  updateSelectedAnnotColor(color) {
    if (!this.selectedAnnot) return;
    this.selectedAnnot.color = color;
    if (this.selectedAnnot.type === 'stamp') {
      this.selectedAnnot.stampColor = color;
    }
    this.onStateChange({ dirty: true });
  }

  updateSelectedAnnotStroke(w) {
    if (!this.selectedAnnot) return;
    this.selectedAnnot.size = w;
    this.onStateChange({ dirty: true });
  }

  deleteSelectedAnnotation() {
    this.hidePropertyToolbar();
    if (!this.selectedAnnot || this.selectedPageIndex === null) return;
    const annots = this.annotationsByPage.get(this.selectedPageIndex) || [];
    const idx = annots.indexOf(this.selectedAnnot);
    if (idx !== -1) {
      const removed = annots.splice(idx, 1)[0];
      this.history.push({
        action: 'delete',
        pageIndex: this.selectedPageIndex,
        annot: removed,
        index: idx
      });
      this.redoStack = [];
      this.selectedAnnot = null;
      this.selectedPageIndex = null;
      showToast('Đã xóa đối tượng ghi chú', 'info');
      this.onStateChange({ dirty: true });
    }
  }

  recordModify(pageIndex, annot, prevProps, newProps) {
    this.history.push({
      action: 'modify',
      pageIndex,
      annot,
      prevProps: { ...prevProps },
      newProps: { ...newProps }
    });
    this.redoStack = [];
    this.onStateChange({ dirty: true });
  }

  hidePropertyToolbar() {
    hidePropertyToolbar(this);
  }

  syncPropertyToolbarValues() {
    syncPropertyToolbarValues(this);
  }

  updatePropertyToolbarPosition(overlayCanvas) {
    updatePropertyToolbarPosition(this, overlayCanvas);
  }

  renderPropertyToolbar(pageIndex, overlayCanvas) {
    renderPropertyToolbar(this, pageIndex, overlayCanvas);
  }

  startDirectInlineEdit(pageIndex, overlayCanvas, annot) {
    startDirectInlineEdit(this, pageIndex, overlayCanvas, annot);
  }

  getAnnotationBounds(annot, overlayCanvas) {
    return getAnnotationBounds(annot, overlayCanvas);
  }

  getSelectionUIGeometry(annot, overlayCanvas) {
    return getSelectionUIGeometry(annot, overlayCanvas);
  }

  hitTestSelectionUI(annot, overlayCanvas, pt) {
    return hitTestSelectionUI(annot, overlayCanvas, pt);
  }

  applyResize(pageIndex, overlayCanvas, pt) {
    applyResize(this.selectedAnnot, this.resizeOrigAnnot, this.resizeOrigBounds, this.resizeHandle, this.resizeStartPt, pt, overlayCanvas);
  }

  hitTestAnnotation(pageIndex, overlayCanvas, pt) {
    return hitTestAnnotation(this.getAnnotationsForPage(pageIndex), overlayCanvas, pt);
  }

  computeCadMeasurement(p1, p2) {
    return computeCadMeasurement(p1, p2, this.scaleRatio, this.unit);
  }

  addAnnotation(pageIndex, annot, recordHistory = true) {
    if (!this.annotationsByPage.has(pageIndex)) {
      this.annotationsByPage.set(pageIndex, []);
    }
    this.annotationsByPage.get(pageIndex).push(annot);
    if (recordHistory) {
      this.history.push({ action: 'add', pageIndex, annot });
      this.redoStack = [];
    }
    this.onStateChange({ dirty: true });
  }

  undo() {
    this.hidePropertyToolbar();
    if (this.history.length === 0) {
      showToast('Không còn thao tác nào để hoàn tác', 'info');
      return;
    }
    const item = this.history.pop();
    if (item.action === 'add') {
      const list = this.annotationsByPage.get(item.pageIndex) || [];
      const idx = list.indexOf(item.annot);
      if (idx !== -1) {
        list.splice(idx, 1);
      }
      this.redoStack.push(item);
      if (this.selectedAnnot === item.annot) {
        this.selectedAnnot = null;
        this.selectedPageIndex = null;
      }
    } else if (item.action === 'delete') {
      let list = this.annotationsByPage.get(item.pageIndex);
      if (!list) {
        list = [];
        this.annotationsByPage.set(item.pageIndex, list);
      }
      const insertIdx = (item.index !== undefined && item.index <= list.length) ? item.index : list.length;
      list.splice(insertIdx, 0, item.annot);
      this.redoStack.push(item);
      this.selectedAnnot = item.annot;
      this.selectedPageIndex = item.pageIndex;
    } else if (item.action === 'modify') {
      Object.assign(item.annot, item.prevProps);
      this.redoStack.push(item);
      this.selectedAnnot = item.annot;
      this.selectedPageIndex = item.pageIndex;
    }
    showToast('Đã hoàn tác (Undo)', 'info');
    this.onStateChange({ dirty: true });
  }

  redo() {
    this.hidePropertyToolbar();
    if (this.redoStack.length === 0) {
      showToast('Không còn thao tác nào để làm lại', 'info');
      return;
    }
    const item = this.redoStack.pop();
    if (item.action === 'add') {
      let list = this.annotationsByPage.get(item.pageIndex);
      if (!list) {
        list = [];
        this.annotationsByPage.set(item.pageIndex, list);
      }
      if (!list.includes(item.annot)) {
        list.push(item.annot);
      }
      this.history.push(item);
      this.selectedAnnot = item.annot;
      this.selectedPageIndex = item.pageIndex;
    } else if (item.action === 'delete') {
      const list = this.annotationsByPage.get(item.pageIndex) || [];
      const idx = list.indexOf(item.annot);
      if (idx !== -1) {
        list.splice(idx, 1);
      }
      this.history.push(item);
      if (this.selectedAnnot === item.annot) {
        this.selectedAnnot = null;
        this.selectedPageIndex = null;
      }
    } else if (item.action === 'modify') {
      Object.assign(item.annot, item.newProps);
      this.history.push(item);
      this.selectedAnnot = item.annot;
      this.selectedPageIndex = item.pageIndex;
    }
    showToast('Đã làm lại (Redo)', 'info');
    this.onStateChange({ dirty: true });
  }

  clearAllAnnotations() {
    this.hidePropertyToolbar();
    this.annotationsByPage.clear();
    this.history = [];
    this.redoStack = [];
    this.onStateChange({ dirty: true });
  }

  findSnapCandidate(pageIndex, overlayCanvas, pt, currentPath, options = {}) {
    const annots = this.getAnnotationsForPage(pageIndex);
    return findSnapCandidate(annots, overlayCanvas, pt, currentPath, options);
  }

  commitShapeDraft() {
    if (!this.shapeDraftPoints || this.shapeDraftPoints.length < 2) {
      this.shapeDraftPoints = null;
      this.activeSnap = null;
      return;
    }
    const pageIndex = this.activePage || 0;
    const isCurve = this.currentTool === 'curve';
    const isClosed = this.activeSnap?.snapType === 'start-point' || this.shapeDraftPoints.length >= 3;
    const newAnnot = {
      id: 'annot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: isCurve ? 'curve' : 'shape',
      points: [...this.shapeDraftPoints],
      isClosed: isClosed,
      isSmooth: isCurve,
      color: this.strokeColor,
      bgColor: isClosed ? 'transparent' : 'none',
      size: this.strokeWidth,
      opacity: 1.0,
      rotation: 0
    };
    this.addAnnotation(pageIndex, newAnnot);
    this.selectedAnnot = newAnnot;
    this.selectedPageIndex = pageIndex;
    this.shapeDraftPoints = null;
    this.activeSnap = null;
    this.setTool('select');
    const overlayCanvas = document.querySelector(`.pdf-page-container[data-page-index="${pageIndex}"] .pdf-annotation-overlay`);
    if (overlayCanvas) {
      this.drawPageOverlay(pageIndex, overlayCanvas);
      this.renderPropertyToolbar(pageIndex, overlayCanvas);
    }
    showToast(`Đã tạo ${isCurve ? 'hình cong' : 'đa giác'} thành công!`, 'success');
  }

  drawPageOverlay(pageIndex, overlayCanvas, previewAnnot = null) {
    const annots = this.getAnnotationsForPage(pageIndex);
    const selected = (this.selectedPageIndex === pageIndex) ? this.selectedAnnot : null;
    drawPageOverlay(pageIndex, overlayCanvas, annots, selected, previewAnnot, this.activeSnap, this.shapeDraftPoints);
  }

  createFinalAnnotation(sp, ep) {
    return createFinalAnnotation(
      this.currentTool,
      sp,
      ep,
      this.strokeColor,
      this.strokeWidth,
      this.highlighterColor,
      this.scaleRatio,
      this.unit,
      this.activeStampText,
      this.activeStampColor,
      this.activeSignatureData
    );
  }

  getPreviewAnnotation() {
    if (this.currentTool === 'pen' && this.currentPath && this.currentPath.length > 0) {
      return {
        type: 'pen',
        points: [...this.currentPath],
        color: this.strokeColor,
        size: this.strokeWidth,
        isClosed: this.activeSnap?.snapType === 'start-point'
      };
    }
    if ((this.currentTool === 'shape' || this.currentTool === 'curve') && this.shapeDraftPoints && this.shapeDraftPoints.length > 0) {
      const pts = [...this.shapeDraftPoints];
      if (this.currentPoint) pts.push(this.currentPoint);
      return {
        type: this.currentTool,
        points: pts,
        color: this.strokeColor,
        size: this.strokeWidth,
        isSmooth: this.currentTool === 'curve',
        isClosed: this.activeSnap?.snapType === 'start-point'
      };
    }
    if (!this.startPoint || !this.currentPoint) return null;
    return getPreviewAnnotation(
      this.currentTool,
      this.startPoint,
      this.currentPoint,
      this.strokeColor,
      this.strokeWidth,
      this.highlighterColor,
      this.scaleRatio,
      this.unit
    );
  }

  bindOverlay(pageIndex, overlayCanvas) {
    const pageBox = overlayCanvas.parentElement;
    if (pageBox) {
      pageBox.onpointermove = (e) => {
        if (this.currentTool === 'select') {
          if (this.isDraggingSelected || this.isResizingSelected) {
            overlayCanvas.style.pointerEvents = 'auto';
            return;
          }
          const sel = window.getSelection();
          if (sel && sel.toString().length > 0) {
            overlayCanvas.style.pointerEvents = 'none';
            return;
          }
          const rect = overlayCanvas.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width;
          const y = (e.clientY - rect.top) / rect.height;
          const pt = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
          const hit = this.hitTestAnnotation(pageIndex, overlayCanvas, pt) || 
                      (this.selectedAnnot && this.hitTestSelectionUI(this.selectedAnnot, overlayCanvas, pt));
          if (hit) {
            overlayCanvas.style.pointerEvents = 'auto';
          } else {
            overlayCanvas.style.pointerEvents = 'none';
          }
        } else {
          overlayCanvas.style.pointerEvents = 'auto';
        }
      };

      pageBox.onpointerdown = (e) => {
        if (e && e.target && e.target.closest && (
          e.target.closest('#annotPropertyToolbar') ||
          e.target.closest('.color-stroke-popover') ||
          e.target.closest('.radius-popover') ||
          e.target.closest('.scale-popover') ||
          e.target.closest('.stamp-popover') ||
          e.target.closest('.font-picker-popover') ||
          e.target.closest('.direct-inline-input') ||
          e.target.tagName === 'INPUT' ||
          e.target.tagName === 'BUTTON'
        )) {
          return;
        }
        if (this.currentTool === 'select' && overlayCanvas.style.pointerEvents === 'none') {
          if (this.selectedAnnot) {
            this.selectedAnnot = null;
            this.selectedPageIndex = null;
            this.hidePropertyToolbar();
            this.drawPageOverlay(pageIndex, overlayCanvas);
          }
        }
      };
    }

    if (this.currentTool === 'select') {
      overlayCanvas.style.pointerEvents = 'none';
    } else {
      overlayCanvas.style.pointerEvents = 'auto';
    }

    const getNormalizedCoords = (e) => {
      const rect = overlayCanvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
    };

    overlayCanvas.onpointerdown = (e) => {
      closeAllPopovers();
      const pt = getNormalizedCoords(e);

      // A. If an annotation is already selected on this page, test if clicking its UI
      if (this.selectedAnnot && this.selectedPageIndex === pageIndex) {
        const hitUI = this.hitTestSelectionUI(this.selectedAnnot, overlayCanvas, pt);
        if (hitUI) {
          if (hitUI.part === 'rotate') {
            e.stopPropagation();
            overlayCanvas.setPointerCapture(e.pointerId);
            this.isRotatingSelected = true;
            const geom = this.getSelectionUIGeometry(this.selectedAnnot, overlayCanvas);
            this.rotateCenter = {
              cx: geom.centerX,
              cy: geom.centerY
            };
            this.rotateOrigRot = this.selectedAnnot.rotation || 0;
            return;
          }
          if (hitUI.part === 'handle') {
            e.stopPropagation();
            overlayCanvas.setPointerCapture(e.pointerId);
            this.isResizingSelected = true;
            this.resizeHandle = hitUI.handle;
            this.resizeStartPt = pt;
            this.resizeOrigBounds = this.getAnnotationBounds(this.selectedAnnot, overlayCanvas);
            this.resizeOrigAnnot = JSON.parse(JSON.stringify(this.selectedAnnot));
            return;
          }
          if (hitUI.part === 'move') {
            e.stopPropagation();
            overlayCanvas.setPointerCapture(e.pointerId);
            this.isDraggingSelected = true;
            this.dragStartCoords = pt;
            this.dragOrigPos = {
              x: this.selectedAnnot.x !== undefined ? this.selectedAnnot.x : 0,
              y: this.selectedAnnot.y !== undefined ? this.selectedAnnot.y : 0,
              x1: this.selectedAnnot.x1 !== undefined ? this.selectedAnnot.x1 : 0,
              y1: this.selectedAnnot.y1 !== undefined ? this.selectedAnnot.y1 : 0,
              x2: this.selectedAnnot.x2 !== undefined ? this.selectedAnnot.x2 : 0,
              y2: this.selectedAnnot.y2 !== undefined ? this.selectedAnnot.y2 : 0,
              points: this.selectedAnnot.points ? JSON.parse(JSON.stringify(this.selectedAnnot.points)) : null
            };
            return;
          }
        }
      }

      // B. Hit test any annotation on page
      const hit = this.hitTestAnnotation(pageIndex, overlayCanvas, pt);
      if (this.currentTool === 'select' || hit) {
        if (hit) {
          this.selectedAnnot = hit;
          this.selectedPageIndex = pageIndex;
          this.isDraggingSelected = true;
          this.dragStartCoords = pt;
          this.dragOrigPos = {
            x: hit.x !== undefined ? hit.x : 0,
            y: hit.y !== undefined ? hit.y : 0,
            x1: hit.x1 !== undefined ? hit.x1 : 0,
            y1: hit.y1 !== undefined ? hit.y1 : 0,
            x2: hit.x2 !== undefined ? hit.x2 : 0,
            y2: hit.y2 !== undefined ? hit.y2 : 0,
            points: hit.points ? JSON.parse(JSON.stringify(hit.points)) : null
          };
          overlayCanvas.setPointerCapture(e.pointerId);
          this.drawPageOverlay(pageIndex, overlayCanvas);
          this.renderPropertyToolbar(pageIndex, overlayCanvas);
          return;
        } else if (this.currentTool === 'select') {
          // Deselect when clicking blank area in select mode
          if (this.selectedAnnot) {
            this.selectedAnnot = null;
            this.selectedPageIndex = null;
            this.hidePropertyToolbar();
            this.drawPageOverlay(pageIndex, overlayCanvas);
          }
          return;
        }
      }

      // Multi-point Photoshop shape & curve tool: click vertices to draw custom arbitrary shapes
      if (this.currentTool === 'shape' || this.currentTool === 'curve') {
        e.stopPropagation();
        this.shapeDraftPoints = this.shapeDraftPoints || [];
        this.activePage = pageIndex;

        // If clicking start point (loop closure), commit immediately
        if (this.shapeDraftPoints.length >= 2 && this.activeSnap?.snapType === 'start-point') {
          this.commitShapeDraft();
          return;
        }

        const addPt = this.activeSnap?.snappedPt || pt;
        this.shapeDraftPoints.push(addPt);
        this.startPoint = this.shapeDraftPoints[0];
        this.currentPoint = addPt;
        this.drawPageOverlay(pageIndex, overlayCanvas, this.getPreviewAnnotation());
        return;
      }

      // Drawing tools
      overlayCanvas.setPointerCapture(e.pointerId);
      this.isDrawing = true;
      this.activePage = pageIndex;
      this.startPoint = pt;
      this.currentPoint = pt;

      if (this.currentTool === 'pen') {
        // Photoshop Shift + Left Click: connect previous point to current point with a straight line!
        if (e.shiftKey && this.lastPenPoint && this.activePage === pageIndex) {
          e.stopPropagation();
          const targetPt = this.activeSnap?.snappedPt || pt;
          const straightSegment = {
            id: 'annot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            type: 'pen',
            points: [{ ...this.lastPenPoint }, { ...targetPt }],
            color: this.strokeColor,
            size: this.strokeWidth
          };
          this.addAnnotation(pageIndex, straightSegment);
          this.lastPenPoint = targetPt;
          this.selectedAnnot = straightSegment;
          this.selectedPageIndex = pageIndex;
          this.isDrawing = false;
          overlayCanvas.releasePointerCapture(e.pointerId);
          this.drawPageOverlay(pageIndex, overlayCanvas);
          this.renderPropertyToolbar(pageIndex, overlayCanvas);
          return;
        }

        const startPt = this.activeSnap?.snappedPt || pt;
        this.currentPath = [startPt];
        this.lastPenPoint = startPt;
      }
    };

    overlayCanvas.onpointermove = (e) => {
      const pt = getNormalizedCoords(e);

      if (this.isRotatingSelected && this.selectedAnnot && this.rotateCenter) {
        const curPx = pt.x * overlayCanvas.width;
        const curPy = pt.y * overlayCanvas.height;
        const dx = curPx - this.rotateCenter.cx;
        const dy = curPy - this.rotateCenter.cy;
        // Rotation handle is at top-center (angle -90 deg relative to +X axis)
        let deg = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        if (deg < 0) deg += 360;
        deg = deg % 360;

        // Angle snapping within 4 degrees to 0, 45, 90, 135, 180, 225, 270, 315
        const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315, 360];
        for (const snap of snapAngles) {
          if (Math.abs(deg - snap) <= 4 || Math.abs(deg - snap + 360) <= 4) {
            deg = snap % 360;
            break;
          }
        }

        const finalDeg = Math.round(deg);
        this.selectedAnnot.rotation = finalDeg;

        this.drawPageOverlay(pageIndex, overlayCanvas);
        this.syncPropertyToolbarValues();
        this.updatePropertyToolbarPosition(overlayCanvas);
        return;
      }

      if (this.isResizingSelected) {
        this.applyResize(pageIndex, overlayCanvas, pt);
        this.drawPageOverlay(pageIndex, overlayCanvas);
        this.updatePropertyToolbarPosition(overlayCanvas);
        return;
      }

      if (this.isDraggingSelected && this.selectedAnnot) {
        const dx = pt.x - this.dragStartCoords.x;
        const dy = pt.y - this.dragStartCoords.y;
        const orig = this.dragOrigPos;

        if (this.selectedAnnot.points && orig.points) {
          this.selectedAnnot.points = orig.points.map(p => ({
            x: Math.max(0, Math.min(1, p.x + dx)),
            y: Math.max(0, Math.min(1, p.y + dy))
          }));
        } else if (this.selectedAnnot.x1 !== undefined && orig.x1 !== undefined) {
          const w = orig.x2 - orig.x1;
          const h = orig.y2 - orig.y1;
          const nx1 = Math.max(0, Math.min(1 - Math.abs(w), orig.x1 + dx));
          const ny1 = Math.max(0, Math.min(1 - Math.abs(h), orig.y1 + dy));
          this.selectedAnnot.x1 = nx1;
          this.selectedAnnot.y1 = ny1;
          this.selectedAnnot.x2 = nx1 + w;
          this.selectedAnnot.y2 = ny1 + h;
        } else if (this.selectedAnnot.x !== undefined && orig.x !== undefined) {
          const aw = this.selectedAnnot.w || 0.1;
          const ah = this.selectedAnnot.h || 0.05;
          this.selectedAnnot.x = Math.max(0, Math.min(1 - aw, orig.x + dx));
          this.selectedAnnot.y = Math.max(0, Math.min(1 - ah, orig.y + dy));
        }

        this.drawPageOverlay(pageIndex, overlayCanvas);
        this.updatePropertyToolbarPosition(overlayCanvas);
        return;
      }

      // Cursor hover feedback
      if (this.selectedAnnot && this.selectedPageIndex === pageIndex) {
        const hitUI = this.hitTestSelectionUI(this.selectedAnnot, overlayCanvas, pt);
        if (hitUI) {
          if (hitUI.part === 'rotate') {
            overlayCanvas.style.cursor = 'crosshair';
            return;
          }
          if (hitUI.part === 'handle') {
            const geom = this.getSelectionUIGeometry(this.selectedAnnot, overlayCanvas);
            overlayCanvas.style.cursor = geom?.handles[hitUI.handle]?.cursor || 'crosshair';
            return;
          }
          if (hitUI.part === 'move') {
            overlayCanvas.style.cursor = 'grab';
            return;
          }
        }
      }

      if (this.currentTool === 'select') {
        const hit = this.hitTestAnnotation(pageIndex, overlayCanvas, pt);
        overlayCanvas.style.cursor = hit ? 'grab' : 'default';
        return;
      }

      // Snapping candidate detection for pen, shape, curve, ruler
      if (this.currentTool === 'pen' || this.currentTool === 'shape' || this.currentTool === 'curve' || this.currentTool === 'ruler') {
        const activePath = (this.currentTool === 'pen') ? this.currentPath : this.shapeDraftPoints;
        const snap = this.findSnapCandidate(pageIndex, overlayCanvas, pt, activePath, { shiftKey: e.shiftKey });
        this.activeSnap = snap;
        if (snap) {
          pt = snap.snappedPt;
        }
      } else {
        this.activeSnap = null;
      }

      // If drafting shape/curve, update rubber-band preview live even without mouse button down
      if ((this.currentTool === 'shape' || this.currentTool === 'curve') && this.shapeDraftPoints && this.shapeDraftPoints.length > 0) {
        this.currentPoint = pt;
        this.drawPageOverlay(pageIndex, overlayCanvas, this.getPreviewAnnotation());
        return;
      }

      // Live drawing preview
      if (!this.isDrawing || this.activePage !== pageIndex) return;
      this.currentPoint = pt;

      if (this.currentTool === 'pen') {
        if (e.shiftKey && this.startPoint) {
          // Photoshop Shift-Drag straight line constraint
          this.currentPath = [this.startPoint, pt];
        } else {
          this.currentPath.push(pt);
        }
      }

      this.drawPageOverlay(pageIndex, overlayCanvas, this.getPreviewAnnotation());
    };

    overlayCanvas.onpointerup = (e) => {
      if (this.isRotatingSelected) {
        this.isRotatingSelected = false;
        overlayCanvas.releasePointerCapture(e.pointerId);

        const oldRot = this.rotateOrigRot;
        const newRot = this.selectedAnnot?.rotation || 0;
        if (oldRot !== newRot && this.selectedAnnot) {
          this.recordModify(pageIndex, this.selectedAnnot, { rotation: oldRot }, { rotation: newRot });
        }
        this.rotateCenter = null;
        this.drawPageOverlay(pageIndex, overlayCanvas);
        this.syncPropertyToolbarValues();
        this.updatePropertyToolbarPosition(overlayCanvas);
        return;
      }

      if (this.isResizingSelected) {
        this.isResizingSelected = false;
        this.resizeHandle = null;
        overlayCanvas.releasePointerCapture(e.pointerId);

        const orig = this.resizeOrigAnnot;
        const cur = this.selectedAnnot;
        if (orig && cur) {
          const prevProps = {};
          const newProps = {};
          let changed = false;
          ['x', 'y', 'w', 'h', 'x1', 'y1', 'x2', 'y2', 'points'].forEach(prop => {
            if (orig[prop] !== undefined && cur[prop] !== undefined) {
              if (JSON.stringify(orig[prop]) !== JSON.stringify(cur[prop])) {
                prevProps[prop] = JSON.parse(JSON.stringify(orig[prop]));
                newProps[prop] = JSON.parse(JSON.stringify(cur[prop]));
                changed = true;
              }
            }
          });
          if (changed) {
            this.recordModify(pageIndex, cur, prevProps, newProps);
          }
        }
        this.resizeOrigAnnot = null;
        this.drawPageOverlay(pageIndex, overlayCanvas);
        this.updatePropertyToolbarPosition(overlayCanvas);
        return;
      }

      if (this.isDraggingSelected) {
        this.isDraggingSelected = false;
        overlayCanvas.releasePointerCapture(e.pointerId);

        const orig = this.dragOrigPos;
        const cur = this.selectedAnnot;
        let hasMoved = false;
        if (orig && cur) {
          if (cur.points && orig.points) {
            hasMoved = cur.points[0]?.x !== orig.points[0]?.x || cur.points[0]?.y !== orig.points[0]?.y;
          } else if (cur.x !== undefined) {
            hasMoved = Math.abs(cur.x - orig.x) > 0.0001 || Math.abs(cur.y - orig.y) > 0.0001;
          } else if (cur.x1 !== undefined) {
            hasMoved = Math.abs(cur.x1 - orig.x1) > 0.0001 || Math.abs(cur.y1 - orig.y1) > 0.0001;
          }
        }

        if (hasMoved && orig && cur) {
          const prevProps = {};
          const newProps = {};
          if (cur.points) {
            prevProps.points = orig.points;
            newProps.points = JSON.parse(JSON.stringify(cur.points));
          } else if (cur.x !== undefined) {
            prevProps.x = orig.x;
            prevProps.y = orig.y;
            newProps.x = cur.x;
            newProps.y = cur.y;
          } else if (cur.x1 !== undefined) {
            prevProps.x1 = orig.x1;
            prevProps.y1 = orig.y1;
            prevProps.x2 = orig.x2;
            prevProps.y2 = orig.y2;
            newProps.x1 = cur.x1;
            newProps.y1 = cur.y1;
            newProps.x2 = cur.x2;
            newProps.y2 = cur.y2;
          }
          this.recordModify(pageIndex, cur, prevProps, newProps);
          this.updatePropertyToolbarPosition(overlayCanvas);
        }

        this.dragOrigPos = null;
        this.drawPageOverlay(pageIndex, overlayCanvas);
        return;
      }

      if (!this.isDrawing || this.activePage !== pageIndex) return;
      this.isDrawing = false;
      overlayCanvas.releasePointerCapture(e.pointerId);
      const endPoint = getNormalizedCoords(e);

      if (this.currentTool === 'pen' && this.currentPath && this.currentPath.length > 1) {
        const isClosed = this.activeSnap?.snapType === 'start-point' || 
          (this.currentPath.length > 8 && Math.hypot(
            this.currentPath[0].x - endPoint.x, 
            this.currentPath[0].y - endPoint.y
          ) < 0.025);

        if (isClosed) {
          this.currentPath.push({ ...this.currentPath[0] });
        }

        const newAnnot = {
          id: 'annot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          type: 'pen',
          points: [...this.currentPath],
          color: this.strokeColor,
          size: this.strokeWidth,
          isClosed: isClosed,
          bgColor: isClosed ? 'transparent' : 'none'
        };
        this.addAnnotation(pageIndex, newAnnot);
        this.lastPenPoint = this.currentPath[this.currentPath.length - 1];
        this.selectedAnnot = newAnnot;
        this.selectedPageIndex = pageIndex;
        this.setTool('select');
        this.renderPropertyToolbar(pageIndex, overlayCanvas);
        this.currentPath = null;
        this.startPoint = null;
        this.currentPoint = null;
        this.activeSnap = null;
        this.drawPageOverlay(pageIndex, overlayCanvas);
        return;
      }

      if (this.currentTool === 'text' || this.currentTool === 'comment') {
        const isComment = this.currentTool === 'comment';
        const fontSize = isComment ? 13 : 14;
        const newAnnot = {
          id: 'annot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          type: isComment ? 'comment' : 'text',
          x: endPoint.x,
          y: endPoint.y,
          w: isComment ? 0.16 : undefined,
          h: isComment ? 0.04 : undefined,
          text: isComment ? '💬 Ghi chú' : 'Văn bản',
          color: isComment ? '#f59e0b' : (this.strokeColor || '#111827'),
          bgColor: isComment ? '#fef3c7' : 'transparent',
          textColor: isComment ? '#92400e' : (this.strokeColor || '#111827'),
          borderRadius: isComment ? 8 : 0,
          size: isComment ? 1.5 : (this.strokeWidth || 2),
          fontSize: fontSize,
          fontFamily: 'sans-serif',
          bold: isComment
        };

        this.addAnnotation(pageIndex, newAnnot);
        this.selectedAnnot = newAnnot;
        this.selectedPageIndex = pageIndex;
        this.setTool('select');
        this.drawPageOverlay(pageIndex, overlayCanvas);
        this.renderPropertyToolbar(pageIndex, overlayCanvas);

        // Seamless inline editing on canvas
        this.startDirectInlineEdit(pageIndex, overlayCanvas, newAnnot);

        this.currentPath = null;
        this.startPoint = null;
        this.currentPoint = null;
        return;
      }

      const newAnnot = this.createFinalAnnotation(this.startPoint, endPoint);
      if (newAnnot) {
        this.addAnnotation(pageIndex, newAnnot);
        this.selectedAnnot = newAnnot;
        this.selectedPageIndex = pageIndex;
        this.setTool('select');
        this.renderPropertyToolbar(pageIndex, overlayCanvas);
      }

      this.currentPath = null;
      this.startPoint = null;
      this.currentPoint = null;

      this.drawPageOverlay(pageIndex, overlayCanvas);
    };

    // Double click on existing text / comment annotation to edit directly, or double-click to finish shape/curve
    overlayCanvas.ondblclick = (e) => {
      if ((this.currentTool === 'shape' || this.currentTool === 'curve') && this.shapeDraftPoints && this.shapeDraftPoints.length >= 2) {
        e.stopPropagation();
        this.commitShapeDraft();
        return;
      }
      const pt = getNormalizedCoords(e);
      const hit = this.hitTestAnnotation(pageIndex, overlayCanvas, pt);
      if (hit && (hit.type === 'text' || hit.type === 'comment')) {
        this.selectedAnnot = hit;
        this.selectedPageIndex = pageIndex;
        this.drawPageOverlay(pageIndex, overlayCanvas);
        this.renderPropertyToolbar(pageIndex, overlayCanvas);
        this.startDirectInlineEdit(pageIndex, overlayCanvas, hit);
      }
    };

    // Initial render of existing annotations on this overlay
    this.drawPageOverlay(pageIndex, overlayCanvas);
  }
}

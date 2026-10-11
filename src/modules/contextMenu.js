/**
 * contextMenu.js
 * Architectural Right-Click Context Menu Manager.
 * Supports:
 * - Text Selection context (Highlight, Copy, Underline, Strikethrough, Cloud enclose, Search, Comment)
 * - Annotation context (Edit properties, Duplicate, Bring to front, Send to back, Delete)
 * - Empty Page context (Add text note, Cloud, Box, CAD ruler, Stamps, Signature, Paste, Page arrangement)
 */

import { getIconHtml } from './iconHelper.js';
import { showToast } from './dialogManager.js';

export class ContextMenuManager {
  constructor({ container, pdfEngine, annotationManager, onSearch = () => {}, onOpenSignature = () => {} }) {
    this.container = container;
    this.pdfEngine = pdfEngine;
    this.annotationManager = annotationManager;
    this.onSearch = onSearch;
    this.onOpenSignature = onOpenSignature;
    this.menuEl = null;

    this.init();
  }

  init() {
    if (!this.container) return;

    this.container.addEventListener('contextmenu', (e) => {
      this.handleContextMenu(e);
    });

    // Dismiss on click outside or escape key
    document.addEventListener('click', (e) => {
      if (this.menuEl && !this.menuEl.contains(e.target)) {
        this.close();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    });
  }

  close() {
    if (this.menuEl) {
      this.menuEl.remove();
      this.menuEl = null;
    }
  }

  handleContextMenu(e) {
    e.preventDefault();
    this.close();

    // 1. Check if text is currently selected
    const sel = window.getSelection();
    const selectedText = sel ? sel.toString().trim() : '';
    const hasTextSelection = selectedText.length > 0;

    // 2. Identify target page container and coordinates
    const pageBox = e.target.closest('.pdf-page-container') || 
      document.elementsFromPoint(e.clientX, e.clientY).find(el => el.classList?.contains('pdf-page-container'));

    let pageIndex = null;
    let overlayCanvas = null;
    let normalizedPt = null;
    let hitAnnot = null;

    if (pageBox) {
      pageIndex = parseInt(pageBox.getAttribute('data-page-num'), 10) - 1;
      overlayCanvas = pageBox.querySelector('.pdf-annotation-overlay');
      if (overlayCanvas) {
        const rect = overlayCanvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        normalizedPt = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
        hitAnnot = this.annotationManager.hitTestAnnotation(pageIndex, overlayCanvas, normalizedPt);
      }
    }

    // 3. Render appropriate context menu
    if (hasTextSelection) {
      this.renderTextSelectionMenu(e, selectedText, pageIndex, overlayCanvas);
    } else if (hitAnnot || (this.annotationManager.selectedAnnot && this.annotationManager.selectedPageIndex === pageIndex)) {
      const targetAnnot = hitAnnot || this.annotationManager.selectedAnnot;
      this.renderAnnotationMenu(e, targetAnnot, pageIndex, overlayCanvas);
    } else if (pageBox && normalizedPt) {
      this.renderPageEmptyMenu(e, pageIndex, overlayCanvas, normalizedPt);
    }
  }

  /**
   * Position menu within viewport bounds
   */
  positionMenu(menu, x, y) {
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 12;
    const maxY = window.innerHeight - rect.height - 12;

    menu.style.left = `${Math.min(maxX, Math.max(10, x))}px`;
    menu.style.top = `${Math.min(maxY, Math.max(10, y))}px`;
  }

  /**
   * 1. MENU CHO VĂN BẢN ĐÃ ĐƯỢC BÔI ĐEN (Text Selection)
   */
  renderTextSelectionMenu(e, selectedText, pageIndex, overlayCanvas) {
    const menu = document.createElement('div');
    menu.className = 'sd-context-menu';
    this.menuEl = menu;

    const displaySnippet = selectedText.length > 20 ? selectedText.substring(0, 18) + '...' : selectedText;

    menu.innerHTML = `
      <div class="cm-header-tag">
        <span>VĂN BẢN · "${displaySnippet}"</span>
        <span>${selectedText.length} KÝ TỰ</span>
      </div>

      <!-- Quick Color Swatches Bar -->
      <div class="cm-swatch-row">
        <span class="cm-swatch-label">Tô màu:</span>
        <div class="cm-swatches-list">
          <button class="cm-swatch-btn" data-color="#f5a623" style="background:#f5a623;" title="Vàng (Kiến trúc)"></button>
          <button class="cm-swatch-btn" data-color="#2e7d32" style="background:#2e7d32;" title="Xanh lá (Phê duyệt)"></button>
          <button class="cm-swatch-btn" data-color="#1976d2" style="background:#1976d2;" title="Xanh dương (Kỹ thuật)"></button>
          <button class="cm-swatch-btn" data-color="#ea80fc" style="background:#ea80fc;" title="Hồng pastel"></button>
          <button class="cm-swatch-btn" data-color="#d32f2f" style="background:#d32f2f;" title="Đỏ (Lưu ý)"></button>
        </div>
      </div>

      <!-- Actions List -->
      <div class="cm-item" data-action="copy">
        <span class="cm-item-icon">${getIconHtml('Copy', { size: 14 })}</span>
        <span class="cm-item-label">Sao chép văn bản</span>
        <span class="cm-item-badge">Ctrl+C</span>
      </div>

      <div class="cm-item" data-action="highlight-default">
        <span class="cm-item-icon">${getIconHtml('Highlighter', { size: 14 })}</span>
        <span class="cm-item-label">Tô màu đánh dấu</span>
      </div>

      <div class="cm-item" data-action="underline">
        <span class="cm-item-icon">${getIconHtml('Underline', { size: 14 })}</span>
        <span class="cm-item-label">Gạch chân văn bản</span>
      </div>

      <div class="cm-item" data-action="strikethrough">
        <span class="cm-item-icon">${getIconHtml('Strikethrough', { size: 14 })}</span>
        <span class="cm-item-label">Gạch ngang xóa</span>
      </div>

      <div class="cm-divider"></div>

      <div class="cm-item" data-action="cloud-wrap">
        <span class="cm-item-icon">${getIconHtml('Cloud', { size: 14 })}</span>
        <span class="cm-item-label">Khoanh vùng đám mây CAD</span>
      </div>

      <div class="cm-item" data-action="box-wrap">
        <span class="cm-item-icon">${getIconHtml('Square', { size: 14 })}</span>
        <span class="cm-item-label">Đóng khung hình chữ nhật</span>
      </div>

      <div class="cm-item" data-action="add-comment">
        <span class="cm-item-icon">${getIconHtml('MessageSquarePlus', { size: 14 })}</span>
        <span class="cm-item-label">Thêm ghi chú tại đây</span>
      </div>

      <div class="cm-divider"></div>

      <div class="cm-item" data-action="search">
        <span class="cm-item-icon">${getIconHtml('Search', { size: 14 })}</span>
        <span class="cm-item-label">Tìm từ khóa này trong tài liệu</span>
        <span class="cm-item-badge">Ctrl+F</span>
      </div>
    `;

    this.positionMenu(menu, e.clientX, e.clientY);

    // Swatches click
    menu.querySelectorAll('.cm-swatch-btn').forEach(btn => {
      btn.onclick = () => {
        const color = btn.getAttribute('data-color');
        this.createHighlightFromSelection(color);
        this.close();
      };
    });

    // Item clicks
    menu.querySelectorAll('.cm-item').forEach(item => {
      item.onclick = async () => {
        const act = item.getAttribute('data-action');
        this.close();

        if (act === 'copy') {
          await navigator.clipboard.writeText(selectedText);
          showToast('Đã sao chép văn bản vào bộ nhớ tạm', 'success');
        } else if (act === 'highlight-default') {
          this.createHighlightFromSelection('#f5a623');
        } else if (act === 'underline') {
          this.createUnderlineFromSelection();
        } else if (act === 'strikethrough') {
          this.createStrikethroughFromSelection();
        } else if (act === 'cloud-wrap') {
          this.createCloudFromSelection();
        } else if (act === 'box-wrap') {
          this.createBoxFromSelection();
        } else if (act === 'add-comment') {
          this.createCommentFromSelection();
        } else if (act === 'search') {
          this.onSearch(selectedText);
        }
      };
    });
  }

  /**
   * 2. MENU CHO ĐỐI TƯỢNG VẼ (Annotation / CAD Markup)
   */
  renderAnnotationMenu(e, annot, pageIndex, overlayCanvas) {
    const menu = document.createElement('div');
    menu.className = 'sd-context-menu';
    this.menuEl = menu;

    menu.innerHTML = `
      <div class="cm-header-tag">
        <span>ĐỐI TƯỢNG · ${annot.type.toUpperCase()}</span>
        <span>TRANG ${pageIndex + 1}</span>
      </div>

      <div class="cm-item" data-action="edit-style">
        <span class="cm-item-icon">${getIconHtml('Palette', { size: 14 })}</span>
        <span class="cm-item-label">Chỉnh sửa màu sắc & nét</span>
      </div>

      <div class="cm-item" data-action="duplicate">
        <span class="cm-item-icon">${getIconHtml('Copy', { size: 14 })}</span>
        <span class="cm-item-label">Nhân bản đối tượng</span>
      </div>

      <div class="cm-divider"></div>

      <div class="cm-item" data-action="bring-front">
        <span class="cm-item-icon">${getIconHtml('ArrowUpToLine', { size: 14 })}</span>
        <span class="cm-item-label">Đưa lên trên cùng</span>
      </div>

      <div class="cm-item" data-action="send-back">
        <span class="cm-item-icon">${getIconHtml('ArrowDownToLine', { size: 14 })}</span>
        <span class="cm-item-label">Đưa xuống dưới cùng</span>
      </div>

      <div class="cm-divider"></div>

      <div class="cm-item danger" data-action="delete">
        <span class="cm-item-icon">${getIconHtml('Trash2', { size: 14 })}</span>
        <span class="cm-item-label">Xóa đối tượng này</span>
        <span class="cm-item-badge">Del</span>
      </div>
    `;

    this.positionMenu(menu, e.clientX, e.clientY);

    menu.querySelectorAll('.cm-item').forEach(item => {
      item.onclick = () => {
        const act = item.getAttribute('data-action');
        this.close();

        if (act === 'edit-style') {
          this.annotationManager.selectedAnnot = annot;
          this.annotationManager.selectedPageIndex = pageIndex;
          this.annotationManager.renderPropertyToolbar(pageIndex, overlayCanvas);
        } else if (act === 'duplicate') {
          this.duplicateAnnotation(annot, pageIndex, overlayCanvas);
        } else if (act === 'bring-front') {
          this.reorderAnnotation(annot, pageIndex, 'front', overlayCanvas);
        } else if (act === 'send-back') {
          this.reorderAnnotation(annot, pageIndex, 'back', overlayCanvas);
        } else if (act === 'delete') {
          this.annotationManager.selectedAnnot = annot;
          this.annotationManager.selectedPageIndex = pageIndex;
          this.annotationManager.deleteSelectedAnnotation();
        }
      };
    });
  }

  /**
   * 3. MENU CHO VÙNG TRỐNG TRÊN BẢN VẼ (Empty Page Canvas)
   */
  renderPageEmptyMenu(e, pageIndex, overlayCanvas, pt) {
    const menu = document.createElement('div');
    menu.className = 'sd-context-menu';
    this.menuEl = menu;

    menu.innerHTML = `
      <div class="cm-header-tag">
        <span>BẢN VẼ · TRANG ${pageIndex + 1}</span>
        <span>X: ${Math.round(pt.x * 100)}% Y: ${Math.round(pt.y * 100)}%</span>
      </div>

      <div class="cm-item" data-action="add-text">
        <span class="cm-item-icon">${getIconHtml('Type', { size: 14 })}</span>
        <span class="cm-item-label">Thêm văn bản tại đây</span>
      </div>

      <div class="cm-item" data-action="add-cloud">
        <span class="cm-item-icon">${getIconHtml('Cloud', { size: 14 })}</span>
        <span class="cm-item-label">Tạo đám mây kiến trúc</span>
      </div>

      <div class="cm-item" data-action="add-rect">
        <span class="cm-item-icon">${getIconHtml('Square', { size: 14 })}</span>
        <span class="cm-item-label">Tạo khung chữ nhật</span>
      </div>

      <div class="cm-item" data-action="measure-ruler">
        <span class="cm-item-icon">${getIconHtml('Ruler', { size: 14 })}</span>
        <span class="cm-item-label">Đo khoảng cách CAD tại đây</span>
      </div>

      <div class="cm-divider"></div>

      <!-- Quick Stamp Submenu -->
      <div class="cm-item cm-submenu-trigger" data-action="stamp-menu">
        <span class="cm-item-icon">${getIconHtml('Stamp', { size: 14 })}</span>
        <span class="cm-item-label">Đóng dấu bản vẽ</span>
        <div class="cm-submenu">
          <div class="cm-item" data-stamp="APPROVED" data-color="#2e7d32">
            <span class="cm-item-icon" style="color:#2e7d32;">✓</span>
            <span class="cm-item-label">APPROVED (Đã duyệt)</span>
          </div>
          <div class="cm-item" data-stamp="DRAFT" data-color="#616161">
            <span class="cm-item-icon" style="color:#616161;">●</span>
            <span class="cm-item-label">DRAFT (Bản nháp)</span>
          </div>
          <div class="cm-item" data-stamp="REVISED" data-color="#1565c0">
            <span class="cm-item-icon" style="color:#1565c0;">✎</span>
            <span class="cm-item-label">REVISED (Đã sửa)</span>
          </div>
          <div class="cm-item" data-stamp="REJECTED" data-color="#d32f2f">
            <span class="cm-item-icon" style="color:#d32f2f;">✕</span>
            <span class="cm-item-label">REJECTED (Từ chối)</span>
          </div>
        </div>
      </div>

      <div class="cm-item" data-action="insert-signature">
        <span class="cm-item-icon">${getIconHtml('PenLine', { size: 14 })}</span>
        <span class="cm-item-label">Chèn chữ ký điện tử</span>
      </div>

      <div class="cm-item" data-action="paste-text">
        <span class="cm-item-icon">${getIconHtml('Clipboard', { size: 14 })}</span>
        <span class="cm-item-label">Dán văn bản từ clipboard</span>
        <span class="cm-item-badge">Ctrl+V</span>
      </div>

      <div class="cm-divider"></div>

      <!-- Page Layout Arrangement Submenu -->
      <div class="cm-item cm-submenu-trigger" data-action="layout-menu">
        <span class="cm-item-icon">${getIconHtml('BookOpen', { size: 14 })}</span>
        <span class="cm-item-label">Sắp xếp hiển thị trang</span>
        <div class="cm-submenu">
          <div class="cm-item" data-layout="1">
            <span class="cm-item-label">1 trang đơn</span>
          </div>
          <div class="cm-item" data-layout="2">
            <span class="cm-item-label">2 trang song song</span>
          </div>
          <div class="cm-item" data-layout="3">
            <span class="cm-item-label">3 trang (3 cột)</span>
          </div>
          <div class="cm-item" data-layout="4">
            <span class="cm-item-label">4 trang (Lưới 2x2)</span>
          </div>
        </div>
      </div>

      <div class="cm-item" data-action="rotate-page">
        <span class="cm-item-icon">${getIconHtml('RotateCw', { size: 14 })}</span>
        <span class="cm-item-label">Xoay 90° theo chiều kim đồng hồ</span>
      </div>
    `;

    this.positionMenu(menu, e.clientX, e.clientY);

    // Submenu stamp selection
    menu.querySelectorAll('[data-stamp]').forEach(stampBtn => {
      stampBtn.onclick = (ev) => {
        ev.stopPropagation();
        const stampText = stampBtn.getAttribute('data-stamp');
        const stampColor = stampBtn.getAttribute('data-color');
        this.close();
        this.insertStampAt(pageIndex, overlayCanvas, pt, stampText, stampColor);
      };
    });

    // Submenu layout selection
    menu.querySelectorAll('[data-layout]').forEach(layoutBtn => {
      layoutBtn.onclick = (ev) => {
        ev.stopPropagation();
        const cols = parseInt(layoutBtn.getAttribute('data-layout'), 10);
        this.close();
        this.pdfEngine.setLayoutCols(cols);
        showToast(`Sắp xếp hiển thị: ${cols} trang`, 'info');
      };
    });

    menu.querySelectorAll('.cm-item:not(.cm-submenu-trigger)').forEach(item => {
      item.onclick = async () => {
        const act = item.getAttribute('data-action');
        this.close();

        if (act === 'add-text') {
          this.insertTextAt(pageIndex, overlayCanvas, pt);
        } else if (act === 'add-cloud') {
          this.insertCloudAt(pageIndex, overlayCanvas, pt);
        } else if (act === 'add-rect') {
          this.insertRectAt(pageIndex, overlayCanvas, pt);
        } else if (act === 'measure-ruler') {
          this.annotationManager.setTool('ruler');
          showToast('Nhấp kéo chuột trên bản vẽ để đo kích thước CAD', 'info');
        } else if (act === 'insert-signature') {
          this.insertSignatureAt(pageIndex, overlayCanvas, pt);
        } else if (act === 'paste-text') {
          try {
            const clipText = await navigator.clipboard.readText();
            if (clipText) {
              this.insertTextAt(pageIndex, overlayCanvas, pt, clipText);
            } else {
              showToast('Bộ nhớ tạm đang trống', 'warning');
            }
          } catch {
            showToast('Không thể đọc bộ nhớ tạm', 'warning');
          }
        } else if (act === 'rotate-page') {
          this.pdfEngine.rotateDocument();
        }
      };
    });
  }

  // --- ACTIONS IMPLEMENTATION ---

  createHighlightFromSelection(color = '#f5a623') {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const clientRects = Array.from(range.getClientRects());
    if (clientRects.length === 0) return;

    let addedCount = 0;
    clientRects.forEach(rect => {
      const elements = document.elementsFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const pageBox = elements.find(el => el.classList?.contains('pdf-page-container'));
      if (!pageBox) return;

      const pageNo = parseInt(pageBox.getAttribute('data-page-num'), 10) - 1;
      const overlay = pageBox.querySelector('.pdf-annotation-overlay');
      if (!overlay) return;

      const overlayRect = overlay.getBoundingClientRect();
      const x = Math.max(0, (rect.left - overlayRect.left) / overlayRect.width);
      const y = Math.max(0, (rect.top - overlayRect.top) / overlayRect.height);
      const w = Math.min(1 - x, rect.width / overlayRect.width);
      const h = Math.min(1 - y, rect.height / overlayRect.height);

      if (w > 0.005 && h > 0.003) {
        const annot = {
          id: 'annot_hl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          type: 'highlight',
          x,
          y,
          w,
          h,
          color,
          opacity: 0.38
        };
        this.annotationManager.addAnnotation(pageNo, annot);
        this.annotationManager.drawPageOverlay(pageNo, overlay);
        addedCount++;
      }
    });

    sel.removeAllRanges();
    if (addedCount > 0) {
      showToast('Đã tô màu đánh dấu văn bản thành công', 'success');
    }
  }

  createUnderlineFromSelection(color = '#111827') {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const clientRects = Array.from(range.getClientRects());
    if (clientRects.length === 0) return;

    clientRects.forEach(rect => {
      const elements = document.elementsFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const pageBox = elements.find(el => el.classList?.contains('pdf-page-container'));
      if (!pageBox) return;

      const pageNo = parseInt(pageBox.getAttribute('data-page-num'), 10) - 1;
      const overlay = pageBox.querySelector('.pdf-annotation-overlay');
      if (!overlay) return;

      const overlayRect = overlay.getBoundingClientRect();
      const x = Math.max(0, (rect.left - overlayRect.left) / overlayRect.width);
      const y = Math.max(0, (rect.bottom - overlayRect.top) / overlayRect.height - 0.002);
      const w = Math.min(1 - x, rect.width / overlayRect.width);
      const h = 0.0025;

      if (w > 0.005) {
        const annot = {
          id: 'annot_ul_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          type: 'rect',
          x,
          y,
          w,
          h,
          color,
          bgColor: color,
          borderRadius: 0,
          size: 1
        };
        this.annotationManager.addAnnotation(pageNo, annot);
        this.annotationManager.drawPageOverlay(pageNo, overlay);
      }
    });

    sel.removeAllRanges();
    showToast('Đã gạch chân văn bản', 'info');
  }

  createStrikethroughFromSelection(color = '#d32f2f') {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const clientRects = Array.from(range.getClientRects());
    if (clientRects.length === 0) return;

    clientRects.forEach(rect => {
      const elements = document.elementsFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const pageBox = elements.find(el => el.classList?.contains('pdf-page-container'));
      if (!pageBox) return;

      const pageNo = parseInt(pageBox.getAttribute('data-page-num'), 10) - 1;
      const overlay = pageBox.querySelector('.pdf-annotation-overlay');
      if (!overlay) return;

      const overlayRect = overlay.getBoundingClientRect();
      const x = Math.max(0, (rect.left - overlayRect.left) / overlayRect.width);
      const y = Math.max(0, (rect.top + rect.height / 2 - overlayRect.top) / overlayRect.height - 0.0015);
      const w = Math.min(1 - x, rect.width / overlayRect.width);
      const h = 0.0025;

      if (w > 0.005) {
        const annot = {
          id: 'annot_st_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          type: 'rect',
          x,
          y,
          w,
          h,
          color,
          bgColor: color,
          borderRadius: 0,
          size: 1
        };
        this.annotationManager.addAnnotation(pageNo, annot);
        this.annotationManager.drawPageOverlay(pageNo, overlay);
      }
    });

    sel.removeAllRanges();
    showToast('Đã gạch ngang xóa văn bản', 'info');
  }

  createCloudFromSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const elements = document.elementsFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const pageBox = elements.find(el => el.classList?.contains('pdf-page-container'));
    if (!pageBox) return;

    const pageNo = parseInt(pageBox.getAttribute('data-page-num'), 10) - 1;
    const overlay = pageBox.querySelector('.pdf-annotation-overlay');
    if (!overlay) return;

    const overlayRect = overlay.getBoundingClientRect();
    const pad = 12;
    const x = Math.max(0, (rect.left - pad - overlayRect.left) / overlayRect.width);
    const y = Math.max(0, (rect.top - pad - overlayRect.top) / overlayRect.height);
    const w = Math.min(1 - x, (rect.width + pad * 2) / overlayRect.width);
    const h = Math.min(1 - y, (rect.height + pad * 2) / overlayRect.height);

    const annot = {
      id: 'annot_cloud_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'cloud',
      x,
      y,
      w,
      h,
      color: '#d32f2f',
      bgColor: 'transparent',
      arcRadius: 14,
      size: 2
    };
    this.annotationManager.addAnnotation(pageNo, annot);
    this.annotationManager.drawPageOverlay(pageNo, overlay);
    sel.removeAllRanges();
    showToast('Đã khoanh đám mây ghi chú CAD', 'info');
  }

  createBoxFromSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const elements = document.elementsFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const pageBox = elements.find(el => el.classList?.contains('pdf-page-container'));
    if (!pageBox) return;

    const pageNo = parseInt(pageBox.getAttribute('data-page-num'), 10) - 1;
    const overlay = pageBox.querySelector('.pdf-annotation-overlay');
    if (!overlay) return;

    const overlayRect = overlay.getBoundingClientRect();
    const pad = 8;
    const x = Math.max(0, (rect.left - pad - overlayRect.left) / overlayRect.width);
    const y = Math.max(0, (rect.top - pad - overlayRect.top) / overlayRect.height);
    const w = Math.min(1 - x, (rect.width + pad * 2) / overlayRect.width);
    const h = Math.min(1 - y, (rect.height + pad * 2) / overlayRect.height);

    const annot = {
      id: 'annot_box_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'rect',
      x,
      y,
      w,
      h,
      color: '#1976d2',
      bgColor: 'transparent',
      borderRadius: 4,
      size: 2
    };
    this.annotationManager.addAnnotation(pageNo, annot);
    this.annotationManager.drawPageOverlay(pageNo, overlay);
    sel.removeAllRanges();
    showToast('Đã đóng khung chữ nhật', 'info');
  }

  createCommentFromSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const elements = document.elementsFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const pageBox = elements.find(el => el.classList?.contains('pdf-page-container'));
    if (!pageBox) return;

    const pageNo = parseInt(pageBox.getAttribute('data-page-num'), 10) - 1;
    const overlay = pageBox.querySelector('.pdf-annotation-overlay');
    if (!overlay) return;

    const overlayRect = overlay.getBoundingClientRect();
    const x = Math.max(0, (rect.left - overlayRect.left) / overlayRect.width);
    const y = Math.max(0, (rect.bottom + 6 - overlayRect.top) / overlayRect.height);

    this.insertTextAt(pageNo, overlay, { x, y }, 'Ghi chú...');
    sel.removeAllRanges();
  }

  duplicateAnnotation(annot, pageIndex, overlayCanvas) {
    const clone = JSON.parse(JSON.stringify(annot));
    clone.id = 'annot_dup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    if (clone.x !== undefined) clone.x += 0.02;
    if (clone.y !== undefined) clone.y += 0.02;
    if (clone.x1 !== undefined) clone.x1 += 0.02;
    if (clone.y1 !== undefined) clone.y1 += 0.02;
    if (clone.x2 !== undefined) clone.x2 += 0.02;
    if (clone.y2 !== undefined) clone.y2 += 0.02;

    this.annotationManager.addAnnotation(pageIndex, clone);
    this.annotationManager.selectedAnnot = clone;
    this.annotationManager.selectedPageIndex = pageIndex;
    this.annotationManager.drawPageOverlay(pageIndex, overlayCanvas);
    this.annotationManager.renderPropertyToolbar(pageIndex, overlayCanvas);
    showToast('Đã nhân bản đối tượng', 'info');
  }

  reorderAnnotation(annot, pageIndex, direction, overlayCanvas) {
    const list = this.annotationManager.annotationsByPage.get(pageIndex) || [];
    const idx = list.indexOf(annot);
    if (idx === -1) return;

    list.splice(idx, 1);
    if (direction === 'front') {
      list.push(annot);
      showToast('Đã đưa đối tượng lên trên cùng', 'info');
    } else {
      list.unshift(annot);
      showToast('Đã đưa đối tượng xuống dưới cùng', 'info');
    }

    this.annotationManager.drawPageOverlay(pageIndex, overlayCanvas);
  }

  insertTextAt(pageIndex, overlayCanvas, pt, defaultText = 'Ghi chú văn bản') {
    const annot = {
      id: 'annot_text_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'text',
      x: pt.x,
      y: pt.y,
      text: defaultText,
      color: '#111827',
      fontSize: 14,
      fontFamily: 'sans-serif'
    };

    this.annotationManager.addAnnotation(pageIndex, annot);
    this.annotationManager.selectedAnnot = annot;
    this.annotationManager.selectedPageIndex = pageIndex;
    this.annotationManager.drawPageOverlay(pageIndex, overlayCanvas);
    this.annotationManager.startDirectInlineEdit(pageIndex, overlayCanvas, annot);
  }

  insertCloudAt(pageIndex, overlayCanvas, pt) {
    const annot = {
      id: 'annot_cloud_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'cloud',
      x: Math.max(0, pt.x - 0.08),
      y: Math.max(0, pt.y - 0.05),
      w: 0.16,
      h: 0.10,
      color: '#d32f2f',
      bgColor: 'transparent',
      arcRadius: 14,
      size: 2
    };

    this.annotationManager.addAnnotation(pageIndex, annot);
    this.annotationManager.selectedAnnot = annot;
    this.annotationManager.selectedPageIndex = pageIndex;
    this.annotationManager.drawPageOverlay(pageIndex, overlayCanvas);
    this.annotationManager.renderPropertyToolbar(pageIndex, overlayCanvas);
    showToast('Đã tạo đám mây kiến trúc', 'info');
  }

  insertRectAt(pageIndex, overlayCanvas, pt) {
    const annot = {
      id: 'annot_rect_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'rect',
      x: Math.max(0, pt.x - 0.08),
      y: Math.max(0, pt.y - 0.05),
      w: 0.16,
      h: 0.10,
      color: '#1976d2',
      bgColor: 'transparent',
      borderRadius: 4,
      size: 2
    };

    this.annotationManager.addAnnotation(pageIndex, annot);
    this.annotationManager.selectedAnnot = annot;
    this.annotationManager.selectedPageIndex = pageIndex;
    this.annotationManager.drawPageOverlay(pageIndex, overlayCanvas);
    this.annotationManager.renderPropertyToolbar(pageIndex, overlayCanvas);
    showToast('Đã tạo khung chữ nhật', 'info');
  }

  insertStampAt(pageIndex, overlayCanvas, pt, stampText, stampColor) {
    const annot = {
      id: 'annot_stamp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'stamp',
      x: Math.max(0, pt.x - 0.09),
      y: Math.max(0, pt.y - 0.04),
      w: 0.18,
      h: 0.07,
      stampText,
      stampColor
    };

    this.annotationManager.addAnnotation(pageIndex, annot);
    this.annotationManager.selectedAnnot = annot;
    this.annotationManager.selectedPageIndex = pageIndex;
    this.annotationManager.drawPageOverlay(pageIndex, overlayCanvas);
    this.annotationManager.renderPropertyToolbar(pageIndex, overlayCanvas);
    showToast(`Đã đóng dấu ${stampText}`, 'success');
  }

  insertSignatureAt(pageIndex, overlayCanvas, pt) {
    if (this.annotationManager.activeSignatureData) {
      const annot = {
        id: 'annot_sig_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        type: 'signature',
        x: Math.max(0, pt.x - 0.08),
        y: Math.max(0, pt.y - 0.04),
        w: 0.16,
        h: 0.08,
        dataUrl: this.annotationManager.activeSignatureData
      };
      this.annotationManager.addAnnotation(pageIndex, annot);
      this.annotationManager.selectedAnnot = annot;
      this.annotationManager.selectedPageIndex = pageIndex;
      this.annotationManager.drawPageOverlay(pageIndex, overlayCanvas);
      this.annotationManager.renderPropertyToolbar(pageIndex, overlayCanvas);
      showToast('Đã chèn chữ ký điện tử', 'success');
    } else {
      this.onOpenSignature();
    }
  }
}

import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import { reorganizeDoc } from './pdfOperations.js';
import { applyLucideIcons } from './iconHelper.js';
import { showToast, showConfirmModal } from './dialogManager.js';

/**
 * OrganizeGrid: Visual card grid for page reordering, rotation, deletion,
 * duplicating, and blank page insertion.
 */
export class OrganizeGrid {
  constructor(options = {}) {
    this.container = options.container;
    this.onApplyChanges = options.onApplyChanges || (() => {});
    this.onClose = options.onClose || (() => {});
    this.currentDocBuffer = null;
    this.pages = []; // Array of { id, originalIndex, rotationDelta, isBlank, thumbnailDataUrl }
    this.selectedIds = new Set();
    this.draggedCardId = null;
  }

  async loadDocument(buffer) {
    this.currentDocBuffer = buffer;
    this.selectedIds.clear();
    this.pages = [];

    const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
    const doc = await loadingTask.promise;
    const numPages = doc.numPages;

    for (let i = 1; i <= numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 0.3 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      this.pages.push({
        id: 'pg_' + i + '_' + Math.random().toString(36).substr(2, 5),
        originalIndex: i - 1,
        pageNumber: i,
        rotationDelta: 0,
        isBlank: false,
        thumbnailDataUrl: canvas.toDataURL('image/jpeg', 0.85)
      });
    }

    this.render();
  }

  toggleSelect(id, multi = false) {
    if (multi) {
      if (this.selectedIds.has(id)) this.selectedIds.delete(id);
      else this.selectedIds.add(id);
    } else {
      if (this.selectedIds.has(id) && this.selectedIds.size === 1) {
        this.selectedIds.clear();
      } else {
        this.selectedIds.clear();
        this.selectedIds.add(id);
      }
    }
    this.renderCardsOnly();
  }

  selectAll() {
    if (this.selectedIds.size === this.pages.length) {
      this.selectedIds.clear();
    } else {
      this.pages.forEach(p => this.selectedIds.add(p.id));
    }
    this.renderCardsOnly();
  }

  rotateSelected(degrees) {
    if (this.selectedIds.size === 0) {
      showToast('Vui lòng chọn ít nhất một trang để xoay.', 'warning');
      return;
    }
    this.pages.forEach(p => {
      if (this.selectedIds.has(p.id)) {
        p.rotationDelta = (p.rotationDelta + degrees + 360) % 360;
      }
    });
    this.renderCardsOnly();
    showToast(`Đã xoay ${this.selectedIds.size} trang đã chọn.`, 'info');
  }

  deleteSelected() {
    if (this.selectedIds.size === 0) {
      showToast('Vui lòng chọn ít nhất một trang để xóa.', 'warning');
      return;
    }
    if (this.pages.length - this.selectedIds.size <= 0) {
      showToast('Tài liệu phải còn lại ít nhất một trang.', 'warning');
      return;
    }

    showConfirmModal({
      title: 'Xóa Trang Đã Chọn',
      message: `Bạn có chắc chắn muốn xóa ${this.selectedIds.size} trang đã chọn khỏi tài liệu?`,
      confirmText: 'Xóa trang',
      isDanger: true,
      onConfirm: () => {
        this.pages = this.pages.filter(p => !this.selectedIds.has(p.id));
        this.selectedIds.clear();
        this.render();
        showToast('Đã xóa các trang đã chọn thành công', 'info');
      }
    });
  }

  duplicateSelected() {
    if (this.selectedIds.size === 0) return;
    const newPages = [];
    this.pages.forEach(p => {
      newPages.push(p);
      if (this.selectedIds.has(p.id)) {
        newPages.push({
          ...p,
          id: 'pg_dup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
        });
      }
    });
    this.pages = newPages;
    this.render();
  }

  insertBlankPage() {
    const blank = {
      id: 'blank_' + Date.now(),
      originalIndex: -1,
      pageNumber: '+',
      rotationDelta: 0,
      isBlank: true,
      thumbnailDataUrl: null
    };
    this.pages.push(blank);
    this.render();
  }

  movePage(fromId, toId) {
    const fromIndex = this.pages.findIndex(p => p.id === fromId);
    const toIndex = this.pages.findIndex(p => p.id === toId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const [moved] = this.pages.splice(fromIndex, 1);
    this.pages.splice(toIndex, 0, moved);
    this.render();
  }

  async applyAndSave() {
    if (this.pages.length === 0) return;
    const descriptors = this.pages.map(p => ({
      originalIndex: p.originalIndex,
      rotationDelta: p.rotationDelta,
      isBlank: p.isBlank
    }));

    try {
      showToast('Đang cập nhật cấu trúc trang tài liệu...', 'info');
      const updatedBytes = await reorganizeDoc(this.currentDocBuffer, descriptors);
      this.onApplyChanges(updatedBytes);
      showToast('Đã lưu cấu trúc trang mới thành công!', 'success');
    } catch (err) {
      console.error('Lỗi sắp xếp lại tài liệu:', err);
      showToast('Lỗi cập nhật trang: ' + err.message, 'error');
    }
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="organize-workbench">
        <div class="organize-top-bar">
          <div class="organize-meta">
            <span class="organize-tag"><span class="brand-main">SDWings</span><span class="brand-blue-dot">.</span><span class="brand-main">PDFReader</span> <span class="brand-by">by</span> <span class="brand-sub-brand"><span class="brand-sub-name">SDWings</span><span class="brand-blue-dot">.</span><span class="brand-sub-x">X</span><sup class="brand-sub-reg">®</sup></span> · PAGE MANAGER</span>
            <h2 class="organize-heading">Sắp Xếp & Quản Lý Trang (Organize Pages)</h2>
            <p class="organize-sub">Kéo thả để đổi thứ tự trang. Chọn trang để xoay, nhân bản hoặc xóa.</p>
          </div>

          <div class="organize-actions">
            <button class="btn-pill btn-light org-back-btn" title="Quay lại xem bản vẽ">
              <span data-icon="ArrowLeft"></span>
              <span>← QUAY LẠI</span>
            </button>
            <button class="btn-pill btn-light org-select-all">
              <span data-icon="CheckSquare"></span>
              <span>${this.selectedIds.size === this.pages.length ? 'BỎ CHỌN' : 'CHỌN TẤT CẢ'}</span>
            </button>
            <button class="btn-pill btn-light org-rotate-cw" title="Xoay 90° theo chiều kim đồng hồ">
              <span data-icon="RotateCw"></span>
              <span>XOAY 90° PHẢI</span>
            </button>
            <button class="btn-pill btn-light org-rotate-ccw" title="Xoay 90° ngược chiều kim đồng hồ">
              <span data-icon="RotateCcw"></span>
              <span>XOAY 90° TRÁI</span>
            </button>
            <button class="btn-pill btn-light org-duplicate" title="Nhân đôi các trang được chọn">
              <span data-icon="Copy"></span>
              <span>NHÂN ĐÔI</span>
            </button>
            <button class="btn-pill btn-light org-insert-blank" title="Chèn thêm 1 trang trắng">
              <span data-icon="FilePlus"></span>
              <span>+ TRANG TRẮNG</span>
            </button>
            <button class="btn-pill btn-light org-delete btn-danger-pill" title="Xóa các trang được chọn">
              <span data-icon="Trash2"></span>
              <span>XÓA TRANG</span>
            </button>
            <button class="btn-pill btn-dark org-apply">
              <span data-icon="Save"></span>
              <span>ÁP DỤNG & LƯU THAY ĐỔI</span>
            </button>
          </div>
        </div>

        <div class="organize-grid-scroll">
          <div class="organize-grid-container" id="organizeGridContainer"></div>
        </div>
      </div>
    `;

    this.bindTopBarEvents();
    this.renderCardsOnly();
    applyLucideIcons(this.container);
  }

  renderCardsOnly() {
    const grid = this.container.querySelector('#organizeGridContainer');
    if (!grid) return;

    grid.innerHTML = this.pages.map((p, idx) => {
      const isSelected = this.selectedIds.has(p.id);
      return `
        <div class="page-card ${isSelected ? 'selected' : ''}" 
             data-id="${p.id}" 
             draggable="true">
          <div class="page-card-header">
            <span class="page-index-badge">${String(idx + 1).padStart(2, '0')}</span>
            ${p.rotationDelta !== 0 ? `<span class="page-rotation-badge">${p.rotationDelta}°</span>` : ''}
            <div class="page-check-box ${isSelected ? 'checked' : ''}">
              ${isSelected ? '✓' : ''}
            </div>
          </div>

          <div class="page-card-thumb-wrapper" style="transform: rotate(${p.rotationDelta}deg)">
            ${p.isBlank ? `
              <div class="page-blank-thumb">TRANG TRẮNG</div>
            ` : `
              <img src="${p.thumbnailDataUrl}" class="page-thumb-img" alt="Trang ${idx + 1}" />
            `}
          </div>

          <div class="page-card-footer">
            <span class="page-title-label">${p.isBlank ? 'Trang trống' : `Gốc: Trang ${p.originalIndex + 1}`}</span>
          </div>
        </div>
      `;
    }).join('');

    this.bindCardEvents();
  }

  bindTopBarEvents() {
    const backBtn = this.container.querySelector('.org-back-btn');
    if (backBtn) backBtn.onclick = () => this.onClose();

    const selAllBtn = this.container.querySelector('.org-select-all');
    if (selAllBtn) selAllBtn.onclick = () => this.selectAll();

    const rotCwBtn = this.container.querySelector('.org-rotate-cw');
    if (rotCwBtn) rotCwBtn.onclick = () => this.rotateSelected(90);

    const rotCcwBtn = this.container.querySelector('.org-rotate-ccw');
    if (rotCcwBtn) rotCcwBtn.onclick = () => this.rotateSelected(-90);

    const dupBtn = this.container.querySelector('.org-duplicate');
    if (dupBtn) dupBtn.onclick = () => this.duplicateSelected();

    const blankBtn = this.container.querySelector('.org-insert-blank');
    if (blankBtn) blankBtn.onclick = () => this.insertBlankPage();

    const delBtn = this.container.querySelector('.org-delete');
    if (delBtn) delBtn.onclick = () => this.deleteSelected();

    const applyBtn = this.container.querySelector('.org-apply');
    if (applyBtn) applyBtn.onclick = () => this.applyAndSave();
  }

  bindCardEvents() {
    const cards = this.container.querySelectorAll('.page-card');
    cards.forEach(card => {
      const id = card.getAttribute('data-id');

      // Click select
      card.onclick = (e) => {
        this.toggleSelect(id, e.ctrlKey || e.metaKey || e.shiftKey);
      };

      // Drag and drop page reorder
      card.ondragstart = (e) => {
        this.draggedCardId = id;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      };

      card.ondragend = () => {
        card.classList.remove('dragging');
        this.container.querySelectorAll('.page-card').forEach(c => c.classList.remove('drag-target'));
      };

      card.ondragover = (e) => {
        e.preventDefault();
        if (this.draggedCardId !== id) {
          card.classList.add('drag-target');
        }
      };

      card.ondragleave = () => {
        card.classList.remove('drag-target');
      };

      card.ondrop = (e) => {
        e.preventDefault();
        card.classList.remove('drag-target');
        if (this.draggedCardId && this.draggedCardId !== id) {
          this.movePage(this.draggedCardId, id);
        }
      };
    });
  }
}

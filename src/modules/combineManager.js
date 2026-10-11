import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import { combinePdfs } from './pdfOperations.js';
import { applyLucideIcons } from './iconHelper.js';
import { showToast } from './dialogManager.js';

/**
 * Manages combining multiple PDF files via Drag & Drop or file picker.
 */
export class CombineManager {
  constructor(options = {}) {
    this.container = options.container;
    this.onCombineComplete = options.onCombineComplete || (() => {});
    this.onCombineExport = options.onCombineExport || (() => {});
    this.onClose = options.onClose || (() => {});
    this.items = []; // Array of { id, file, buffer, name, size, pageCount, pageRange, thumbnailDataUrl }
  }

  async addFiles(fileList) {
    for (const file of fileList) {
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        continue;
      }

      const buffer = await file.arrayBuffer();
      let pageCount = 1;
      let thumbnailDataUrl = null;

      try {
        const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
        const doc = await loadingTask.promise;
        pageCount = doc.numPages;

        // Render first page as miniature thumbnail
        const page1 = await doc.getPage(1);
        const viewport = page1.getViewport({ scale: 0.25 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext('2d');
        await page1.render({ canvasContext: ctx, viewport }).promise;
        thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      } catch (err) {
        console.warn('Could not extract page count/thumb for combine item:', err);
      }

      this.items.push({
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        file,
        buffer,
        name: file.name,
        size: this.formatBytes(file.size),
        pageCount,
        pageRange: 'All',
        thumbnailDataUrl
      });
    }

    this.render();
  }

  formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  removeItem(id) {
    this.items = this.items.filter(item => item.id !== id);
    this.render();
  }

  moveItem(fromIndex, toIndex) {
    if (toIndex < 0 || toIndex >= this.items.length) return;
    const [moved] = this.items.splice(fromIndex, 1);
    this.items.splice(toIndex, 0, moved);
    this.render();
  }

  clearAll() {
    this.items = [];
    this.render();
  }

  async executeCombine(openInViewer = true) {
    if (this.items.length === 0) {
      showToast('Vui lòng kéo thả hoặc thêm ít nhất một file PDF để ghép nối.', 'warning');
      return;
    }

    const payload = this.items.map(item => ({
      buffer: item.buffer,
      name: item.name,
      pageRange: item.pageRange
    }));

    try {
      showToast('Đang xử lý ghép nối tài liệu PDF...', 'info');
      const mergedBytes = await combinePdfs(payload);
      if (openInViewer) {
        this.onCombineComplete(mergedBytes, `SDWings_Combined_${this.items.length}_files.pdf`);
      } else {
        this.onCombineExport(mergedBytes, `SDWings_Combined_${this.items.length}_files.pdf`);
      }
      showToast('Ghép nối PDF thành công!', 'success');
    } catch (err) {
      console.error('Lỗi khi ghép file:', err);
      showToast('Lỗi ghép file PDF: ' + err.message, 'error');
    }
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="combine-workbench">
        <div class="combine-header">
          <div class="combine-header-info">
            <span class="combine-tag"><span class="brand-main">SDWings</span><span class="brand-blue-dot">.</span><span class="brand-main">PDFReader</span> <span class="brand-by">by</span> <span class="brand-sub-brand"><span class="brand-sub-name">SDWings</span><span class="brand-blue-dot">.</span><span class="brand-sub-x">X</span><sup class="brand-sub-reg">®</sup></span> · COMBINE QUEUE</span>
            <h2 class="combine-title">Ghép Nối Tài Liệu PDF (Batch Merge)</h2>
            <p class="combine-desc">Kéo thả các file PDF từ File Explorer / Desktop vào vùng dưới đây. Sắp xếp thứ tự và chọn khoảng trang cần ghép.</p>
          </div>
          <div class="combine-header-actions">
            <button class="btn-pill btn-light combine-back-btn" title="Quay lại xem bản vẽ">
              <span data-icon="ArrowLeft"></span>
              <span>← QUAY LẠI</span>
            </button>
            <label class="btn-pill btn-light add-file-btn">
              <span data-icon="PlusCircle"></span>
              <span>+ THÊM FILE TỪ MÁY</span>
              <input type="file" multiple accept=".pdf,application/pdf" style="display:none" class="combine-file-input" />
            </label>
            <button class="btn-pill btn-light clear-btn" ${this.items.length === 0 ? 'disabled' : ''}>
              <span data-icon="Trash2"></span>
              <span>XÓA DANH SÁCH</span>
            </button>
            <button class="btn-pill btn-dark merge-open-btn" ${this.items.length === 0 ? 'disabled' : ''}>
              <span data-icon="Check"></span>
              <span>● GHÉP NỐI & XEM NGAY</span>
            </button>
            <button class="btn-pill btn-dark merge-download-btn" ${this.items.length === 0 ? 'disabled' : ''}>
              <span data-icon="Download"></span>
              <span>TẢI FILE ĐÃ GHÉP</span>
            </button>
          </div>
        </div>

        <div class="combine-drop-zone ${this.items.length === 0 ? 'empty' : ''}" id="combineDropZone">
          ${this.items.length === 0 ? `
            <div class="combine-empty-state">
              <div class="empty-icon-box">
                <span data-icon="Files" data-size="48" data-stroke="1.2"></span>
              </div>
              <h3 class="empty-title">KÉO VÀ THẢ CÁC FILE PDF VÀO ĐÂY</h3>
              <p class="empty-sub">Hỗ trợ kéo thả đồng thời nhiều tệp từ Windows Explorer hoặc Desktop</p>
              <span class="empty-badge">KHÔNG GIỚI HẠN DUNG LƯỢNG · XỬ LÝ 100% OFFLINE</span>
            </div>
          ` : `
            <div class="combine-card-list">
              ${this.items.map((item, idx) => `
                <div class="combine-card" data-index="${idx}" data-id="${item.id}">
                  <div class="card-seq-col">
                    <span class="card-seq-num">#${String(idx + 1).padStart(2, '0')}</span>
                    <div class="card-move-buttons">
                      <button class="move-btn move-up" title="Đưa lên" ${idx === 0 ? 'disabled' : ''}>
                        <span data-icon="ChevronUp" data-size="10"></span>
                      </button>
                      <button class="move-btn move-down" title="Đưa xuống" ${idx === this.items.length - 1 ? 'disabled' : ''}>
                        <span data-icon="ChevronDown" data-size="10"></span>
                      </button>
                    </div>
                  </div>

                  <div class="card-thumb-col">
                    ${item.thumbnailDataUrl ? `
                      <img src="${item.thumbnailDataUrl}" class="card-thumb-img" alt="thumb" />
                    ` : `
                      <div class="card-thumb-placeholder">PDF</div>
                    `}
                  </div>

                  <div class="card-details-col">
                    <div class="card-filename" title="${item.name}">${item.name}</div>
                    <div class="card-meta">
                      <span>${item.pageCount} trang</span>
                      <span class="meta-dot">·</span>
                      <span>${item.size}</span>
                    </div>
                  </div>

                  <div class="card-range-col">
                    <label class="range-label">Khoảng trang:</label>
                    <input type="text" class="card-range-input" value="${item.pageRange}" placeholder="vd: All hoặc 1-3, 5" title="Nhập All hoặc khoảng trang như 1-3, 5" />
                  </div>

                  <div class="card-action-col">
                    <button class="btn-remove-item" title="Xóa khỏi danh sách">
                      <span data-icon="Trash2" data-size="14"></span>
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;

    this.bindEvents();
    applyLucideIcons(this.container);
  }

  bindEvents() {
    const backBtn = this.container.querySelector('.combine-back-btn');
    if (backBtn) {
      backBtn.onclick = () => this.onClose();
    }

    const fileInput = this.container.querySelector('.combine-file-input');
    if (fileInput) {
      fileInput.onchange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.addFiles(Array.from(e.target.files));
        }
      };
    }

    const clearBtn = this.container.querySelector('.clear-btn');
    if (clearBtn) {
      clearBtn.onclick = () => this.clearAll();
    }

    const mergeOpenBtn = this.container.querySelector('.merge-open-btn');
    if (mergeOpenBtn) {
      mergeOpenBtn.onclick = () => this.executeCombine(true);
    }

    const mergeDownloadBtn = this.container.querySelector('.merge-download-btn');
    if (mergeDownloadBtn) {
      mergeDownloadBtn.onclick = () => this.executeCombine(false);
    }

    // Move & Remove buttons
    this.container.querySelectorAll('.combine-card').forEach(card => {
      const idx = parseInt(card.getAttribute('data-index'), 10);
      const id = card.getAttribute('data-id');

      const upBtn = card.querySelector('.move-up');
      if (upBtn) upBtn.onclick = () => this.moveItem(idx, idx - 1);

      const downBtn = card.querySelector('.move-down');
      if (downBtn) downBtn.onclick = () => this.moveItem(idx, idx + 1);

      const removeBtn = card.querySelector('.btn-remove-item');
      if (removeBtn) removeBtn.onclick = () => this.removeItem(id);

      const rangeInput = card.querySelector('.card-range-input');
      if (rangeInput) {
        rangeInput.onchange = (e) => {
          const item = this.items.find(it => it.id === id);
          if (item) item.pageRange = e.target.value;
        };
      }
    });

    // Dedicated drop zone events
    const dropZone = this.container.querySelector('#combineDropZone');
    if (dropZone) {
      dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      };
      dropZone.ondragleave = () => {
        dropZone.classList.remove('dragover');
      };
      dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.addFiles(Array.from(e.dataTransfer.files));
        }
      };
    }
  }
}

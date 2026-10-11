import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import { splitPdf } from './pdfOperations.js';
import { applyLucideIcons } from './iconHelper.js';
import { showToast } from './dialogManager.js';

/**
 * SplitManager: Provides visual page preview & selection (Image 2 style)
 * alongside flexible splitting options (every page, every N pages, custom ranges, extract).
 */
export class SplitManager {
  constructor(options = {}) {
    this.container = options.container;
    this.currentDocBuffer = null;
    this.docName = 'document.pdf';
    this.numPages = 1;
    this.pages = []; // Array of { pageNumber, originalIndex, thumbnailDataUrl }
    this.selectedPages = new Set(); // Set of 1-based page numbers
    this.isLoadingThumbnails = false;
    this.onExport = options.onExport || (() => {});
    this.onClose = options.onClose || (() => {});
  }

  async loadDocument(buffer, name, numPages) {
    this.currentDocBuffer = buffer;
    this.docName = name || 'document.pdf';
    this.numPages = numPages || 1;
    this.pages = [];
    this.selectedPages = new Set();

    // Default selection: if >= 2 pages, select [1, 2], else [1]
    if (this.numPages >= 2) {
      this.selectedPages.add(1);
      this.selectedPages.add(2);
    } else {
      this.selectedPages.add(1);
    }

    // Render initial layout immediately
    this.render();

    // Generate thumbnails asynchronously
    if (buffer) {
      this.isLoadingThumbnails = true;
      try {
        const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
        const doc = await loadingTask.promise;
        this.numPages = doc.numPages;
        const loaded = [];

        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 0.3 });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;

          loaded.push({
            pageNumber: i,
            originalIndex: i - 1,
            thumbnailDataUrl: canvas.toDataURL('image/jpeg', 0.85)
          });
        }
        this.pages = loaded;
      } catch (err) {
        console.warn('Lỗi tạo ảnh xem trước trang trong SplitManager:', err);
      } finally {
        this.isLoadingThumbnails = false;
        this.renderPagesGrid();
        this.updateSelectionUI();
      }
    }
  }

  getSelectedPagesString() {
    return Array.from(this.selectedPages).sort((a, b) => a - b).join(', ');
  }

  toggleSelectPage(pageNumber) {
    if (this.selectedPages.has(pageNumber)) {
      this.selectedPages.delete(pageNumber);
    } else {
      this.selectedPages.add(pageNumber);
    }
    this.updateSelectionUI();
  }

  selectAllPages() {
    if (this.selectedPages.size === this.numPages) {
      this.selectedPages.clear();
    } else {
      for (let i = 1; i <= this.numPages; i++) {
        this.selectedPages.add(i);
      }
    }
    this.updateSelectionUI();
  }

  updateSelectionUI() {
    if (!this.container) return;

    // 1. Update page cards
    const cards = this.container.querySelectorAll('.split-pages-grid .page-card');
    cards.forEach(card => {
      const pNum = parseInt(card.getAttribute('data-page'), 10);
      const isSel = this.selectedPages.has(pNum);
      card.classList.toggle('selected', isSel);
      const chk = card.querySelector('.page-check-box');
      if (chk) {
        chk.classList.toggle('checked', isSel);
        chk.textContent = isSel ? '✓' : '';
      }
    });

    // 2. Update selection badge
    const badge = this.container.querySelector('#splitSelectedBadge');
    if (badge) {
      badge.textContent = `ĐÃ CHỌN: ${this.selectedPages.size} / ${this.numPages} TRANG`;
    }

    // 3. Update select all button label
    const selectAllLabel = this.container.querySelector('.split-select-all-label');
    if (selectAllLabel) {
      selectAllLabel.textContent = this.selectedPages.size === this.numPages ? 'BỎ CHỌN TẤT CẢ' : 'CHỌN TẤT CẢ';
    }

    // 4. Update Card 4 (Extract Pages) input value
    const extractInput = this.container.querySelector('#splitExtractInput');
    if (extractInput && document.activeElement !== extractInput) {
      extractInput.value = this.getSelectedPagesString();
    }
  }

  handleExtractInputChange(val) {
    const parts = val.split(',').map(s => s.trim()).filter(Boolean);
    const newSelected = new Set();

    for (const p of parts) {
      if (p.includes('-')) {
        const [s, e] = p.split('-').map(x => parseInt(x, 10));
        if (!isNaN(s) && !isNaN(e)) {
          const start = Math.min(s, e);
          const end = Math.max(s, e);
          for (let i = start; i <= end; i++) {
            if (i >= 1 && i <= this.numPages) newSelected.add(i);
          }
        }
      } else {
        const n = parseInt(p, 10);
        if (!isNaN(n) && n >= 1 && n <= this.numPages) {
          newSelected.add(n);
        }
      }
    }

    this.selectedPages = newSelected;
    // Update cards & badge without overwriting current typing input
    const cards = this.container.querySelectorAll('.split-pages-grid .page-card');
    cards.forEach(card => {
      const pNum = parseInt(card.getAttribute('data-page'), 10);
      const isSel = this.selectedPages.has(pNum);
      card.classList.toggle('selected', isSel);
      const chk = card.querySelector('.page-check-box');
      if (chk) {
        chk.classList.toggle('checked', isSel);
        chk.textContent = isSel ? '✓' : '';
      }
    });

    const badge = this.container.querySelector('#splitSelectedBadge');
    if (badge) {
      badge.textContent = `ĐÃ CHỌN: ${this.selectedPages.size} / ${this.numPages} TRANG`;
    }

    const selectAllLabel = this.container.querySelector('.split-select-all-label');
    if (selectAllLabel) {
      selectAllLabel.textContent = this.selectedPages.size === this.numPages ? 'BỎ CHỌN TẤT CẢ' : 'CHỌN TẤT CẢ';
    }
  }

  async executeSplit(mode, options = {}) {
    if (!this.currentDocBuffer) {
      showToast('Chưa có tài liệu nào để tách trang.', 'warning');
      return;
    }

    try {
      showToast('Đang tiến hành tách trang...', 'info');
      const result = await splitPdf(this.currentDocBuffer, mode, {
        baseName: this.docName,
        ...options
      });

      this.renderResults(result);
      showToast(`Tách thành công ${result.files.length} tệp tài liệu!`, 'success');
    } catch (err) {
      console.error('Lỗi tách trang:', err);
      showToast('Lỗi tách trang PDF: ' + err.message, 'error');
    }
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="split-workbench">
        <!-- Header -->
        <div class="split-header">
          <div class="split-header-row" style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <span class="split-tag"><span class="brand-main">SDWings</span><span class="brand-blue-dot">.</span><span class="brand-main">PDFReader</span> <span class="brand-by">by</span> <span class="brand-sub-brand"><span class="brand-sub-name">SDWings</span><span class="brand-blue-dot">.</span><span class="brand-sub-x">X</span><sup class="brand-sub-reg">®</sup></span> · SPLIT & EXTRACT</span>
              <h2 class="split-heading">Tách Trang & Trích Xuất PDF (Split & Extract)</h2>
              <p class="split-desc">Tài liệu đang mở: <strong>${this.docName}</strong> (${this.numPages} trang). Nhấp chọn trực quan các trang bên dưới hoặc chọn phương thức tách trang phù hợp.</p>
            </div>
            <button class="btn-pill btn-light split-back-btn" title="Quay lại xem bản vẽ">
              <span data-icon="ArrowLeft"></span>
              <span>← QUAY LẠI</span>
            </button>
          </div>
        </div>

        <!-- Visual Page Preview Section (Giống Hình 2) -->
        <div class="split-preview-section">
          <div class="split-preview-header">
            <div class="split-preview-title-col">
              <div class="split-preview-title">
                <span data-icon="LayoutGrid" data-size="16"></span>
                <span>Trang Tài Liệu Cần Tách (Page Visual Preview)</span>
              </div>
              <span class="split-preview-hint">Nhấp vào từng trang hoặc ô kiểm để chọn các trang muốn trích xuất hoặc tách riêng</span>
            </div>
            <div class="split-preview-actions">
              <button class="btn-pill btn-light split-btn-select-all" title="Chọn hoặc bỏ chọn tất cả các trang">
                <span data-icon="CheckSquare"></span>
                <span class="split-select-all-label">${this.selectedPages.size === this.numPages ? 'BỎ CHỌN TẤT CẢ' : 'CHỌN TẤT CẢ'}</span>
              </button>
              <span class="split-selected-badge" id="splitSelectedBadge">ĐÃ CHỌN: ${this.selectedPages.size} / ${this.numPages} TRANG</span>
            </div>
          </div>

          <div class="split-pages-grid" id="splitPagesGrid"></div>
        </div>

        <!-- Split Methods Options Grid (Hình 1) -->
        <div class="split-options-grid">
          <!-- Card 1: Every Page -->
          <div class="split-card">
            <div class="split-card-badge">TÁCH ĐƠN LẺ</div>
            <h3 class="split-card-title">Tách Thành Từng Trang Riêng Biệt</h3>
            <p class="split-card-desc">Mỗi trang của tài liệu sẽ trở thành một file PDF độc lập (${this.numPages} file). Đóng gói tự động thành file ZIP.</p>
            <div class="split-card-actions">
              <button class="btn-pill btn-dark btn-split-every-page">
                <span data-icon="Archive"></span>
                <span>TÁCH TẤT CẢ (${this.numPages} FILE ZIP)</span>
              </button>
            </div>
          </div>

          <!-- Card 2: Every N Pages -->
          <div class="split-card">
            <div class="split-card-badge">TÁCH THEO NHÓM</div>
            <h3 class="split-card-title">Tách Theo Số Trang Cố Định</h3>
            <p class="split-card-desc">Chia tài liệu thành các file nhỏ, mỗi file chứa N trang liên tiếp.</p>
            <div class="split-card-input-row">
              <label>Số trang mỗi file:</label>
              <input type="number" class="split-input-number" id="splitEveryNInput" value="2" min="1" max="${this.numPages}" />
            </div>
            <div class="split-card-actions">
              <button class="btn-pill btn-dark btn-split-every-n">
                <span data-icon="Columns3"></span>
                <span>TÁCH THEO NHÓM N TRANG</span>
              </button>
            </div>
          </div>

          <!-- Card 3: Custom Ranges -->
          <div class="split-card">
            <div class="split-card-badge">TÁCH TÙY BIẾN</div>
            <h3 class="split-card-title">Tách Theo Dải Trang Chỉ Định</h3>
            <p class="split-card-desc">Chia tài liệu theo các khoảng trang tùy chọn, phân tách bằng dấu chấm phẩy (;).</p>
            <div class="split-card-input-row">
              <label>Khoảng trang:</label>
              <input type="text" class="split-input-text" id="splitRangesInput" placeholder="vd: 1-2; 3-${this.numPages}" value="1-2; 3-${this.numPages}" />
            </div>
            <div class="split-card-actions">
              <button class="btn-pill btn-dark btn-split-ranges">
                <span data-icon="Split"></span>
                <span>TÁCH THEO DẢI TRANG</span>
              </button>
            </div>
          </div>

          <!-- Card 4: Extract Pages (Tương tác trực quan với các trang được tick chọn) -->
          <div class="split-card">
            <div class="split-card-badge">TRÍCH XUẤT</div>
            <h3 class="split-card-title">Trích Xuất Các Trang Thành 1 File Mới</h3>
            <p class="split-card-desc">Chọn lọc các trang cần lấy (vd: 1, 3, 5-7) để gom thành 1 tệp PDF duy nhất.</p>
            <div class="split-card-input-row">
              <label>Các trang cần lấy:</label>
              <input type="text" class="split-input-text" id="splitExtractInput" placeholder="vd: 1, 2" value="${this.getSelectedPagesString()}" />
            </div>
            <div class="split-card-actions">
              <button class="btn-pill btn-dark btn-split-extract">
                <span data-icon="FileText"></span>
                <span>TRÍCH XUẤT THÀNH 1 FILE</span>
              </button>
            </div>
          </div>
        </div>

        <div class="split-output-zone" id="splitOutputZone" style="display: none;"></div>
      </div>
    `;

    this.renderPagesGrid();
    this.bindEvents();
    applyLucideIcons(this.container);
  }

  renderPagesGrid() {
    const grid = this.container ? this.container.querySelector('#splitPagesGrid') : null;
    if (!grid) return;

    if (this.isLoadingThumbnails && this.pages.length === 0) {
      grid.innerHTML = `
        <div class="split-loading-box">
          <div class="split-loading-spinner"></div>
          <span>Đang nạp ảnh xem trước các trang bản vẽ (${this.numPages} trang)...</span>
        </div>
      `;
      return;
    }

    const items = this.pages.length > 0 ? this.pages : Array.from({ length: this.numPages }, (_, i) => ({
      pageNumber: i + 1,
      originalIndex: i,
      thumbnailDataUrl: null
    }));

    grid.innerHTML = items.map((p) => {
      const isSelected = this.selectedPages.has(p.pageNumber);
      return `
        <div class="page-card ${isSelected ? 'selected' : ''}" data-page="${p.pageNumber}" title="Nhấp để chọn / bỏ chọn trang ${p.pageNumber}">
          <div class="page-card-header">
            <span class="page-index-badge">${String(p.pageNumber).padStart(2, '0')}</span>
            <div class="page-check-box ${isSelected ? 'checked' : ''}">
              ${isSelected ? '✓' : ''}
            </div>
          </div>

          <div class="page-card-thumb-wrapper">
            ${p.thumbnailDataUrl ? `
              <img src="${p.thumbnailDataUrl}" class="page-thumb-img" alt="Trang ${p.pageNumber}" />
            ` : `
              <div class="page-blank-thumb" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--text-secondary); font-size:12px;">
                <span data-icon="FileText" data-size="28"></span>
                <span style="margin-top:6px; font-weight:500;">Trang ${p.pageNumber}</span>
              </div>
            `}
          </div>

          <div class="page-card-footer">
            <span class="page-title-label">Gốc: Trang ${p.pageNumber}</span>
          </div>
        </div>
      `;
    }).join('');

    applyLucideIcons(grid);

    // Bind card click
    grid.querySelectorAll('.page-card').forEach(card => {
      card.onclick = () => {
        const pageNum = parseInt(card.getAttribute('data-page'), 10);
        this.toggleSelectPage(pageNum);
      };
    });
  }

  bindEvents() {
    const backBtn = this.container.querySelector('.split-back-btn');
    if (backBtn) {
      backBtn.onclick = () => this.onClose();
    }

    const selectAllBtn = this.container.querySelector('.split-btn-select-all');
    if (selectAllBtn) {
      selectAllBtn.onclick = () => this.selectAllPages();
    }

    const extractInput = this.container.querySelector('#splitExtractInput');
    if (extractInput) {
      extractInput.oninput = (e) => this.handleExtractInputChange(e.target.value);
    }

    const everyPageBtn = this.container.querySelector('.btn-split-every-page');
    if (everyPageBtn) {
      everyPageBtn.onclick = () => this.executeSplit('every-page');
    }

    const everyNBtn = this.container.querySelector('.btn-split-every-n');
    if (everyNBtn) {
      everyNBtn.onclick = () => {
        const val = parseInt(this.container.querySelector('#splitEveryNInput').value, 10);
        this.executeSplit('every-n', { everyN: val });
      };
    }

    const rangesBtn = this.container.querySelector('.btn-split-ranges');
    if (rangesBtn) {
      rangesBtn.onclick = () => {
        const ranges = this.container.querySelector('#splitRangesInput').value;
        this.executeSplit('ranges', { ranges });
      };
    }

    const extractBtn = this.container.querySelector('.btn-split-extract');
    if (extractBtn) {
      extractBtn.onclick = () => {
        const extractStr = this.container.querySelector('#splitExtractInput').value;
        // Parse into page indices (0-based)
        const parts = extractStr.split(',').map(s => s.trim()).filter(Boolean);
        const indices = [];
        for (const p of parts) {
          if (p.includes('-')) {
            const [s, e] = p.split('-').map(x => parseInt(x, 10));
            if (!isNaN(s) && !isNaN(e)) {
              const start = Math.min(s, e);
              const end = Math.max(s, e);
              for (let i = start; i <= end; i++) {
                if (i >= 1 && i <= this.numPages) indices.push(i - 1);
              }
            }
          } else {
            const n = parseInt(p, 10);
            if (!isNaN(n) && n >= 1 && n <= this.numPages) indices.push(n - 1);
          }
        }

        if (indices.length === 0) {
          showToast('Vui lòng chọn ít nhất 1 trang để trích xuất.', 'warning');
          return;
        }

        // Deduplicate indices while preserving ascending order
        const uniqueIndices = Array.from(new Set(indices)).sort((a, b) => a - b);
        this.executeSplit('extract', { pageIndices: uniqueIndices });
      };
    }
  }

  renderResults(result) {
    const outZone = this.container.querySelector('#splitOutputZone');
    if (!outZone) return;

    outZone.style.display = 'block';
    outZone.innerHTML = `
      <div class="split-results-card">
        <div class="split-results-header">
          <div>
            <span class="split-tag">KẾT QUẢ TÁCH TRANG</span>
            <h3 class="split-res-title">Đã tạo thành công ${result.files.length} file PDF</h3>
          </div>
          <button class="btn-pill btn-dark download-zip-btn">
            <span data-icon="Download"></span>
            <span>TẢI TẤT CẢ FILE (.ZIP)</span>
          </button>
        </div>

        <div class="split-files-table">
          ${result.files.map((f, i) => `
            <div class="split-file-row">
              <span class="file-num">#${String(i + 1).padStart(2, '0')}</span>
              <span class="file-name">${f.name}</span>
              <button class="btn-pill btn-light btn-download-single" data-index="${i}">
                <span data-icon="Download"></span>
                <span>Tải file này</span>
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    applyLucideIcons(outZone);
    outZone.scrollIntoView({ behavior: 'smooth' });

    const zipBtn = outZone.querySelector('.download-zip-btn');
    if (zipBtn && result.zipBlob) {
      zipBtn.onclick = () => this.downloadBlob(result.zipBlob, `${this.docName.replace(/\.pdf$/i, '')}_split_bundle.zip`);
    }

    outZone.querySelectorAll('.btn-download-single').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        const f = result.files[idx];
        const blob = new Blob([f.bytes], { type: 'application/pdf' });
        this.downloadBlob(blob, f.name);
      };
    });
  }
}

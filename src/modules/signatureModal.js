import { applyLucideIcons } from './iconHelper.js';
import { showToast } from './dialogManager.js';

/**
 * SignatureModal: High-resolution signature canvas for signing contracts,
 * drawings, approval sheets, and embedding directly onto PDF pages.
 */
export class SignatureModal {
  constructor(options = {}) {
    this.onSave = options.onSave || (() => {});
    this.modalEl = null;
    this.canvas = null;
    this.ctx = null;
    this.isDrawing = false;
    this.strokes = [];
    this.currentStroke = [];
    this.color = '#111111';
  }

  show() {
    this.close();

    this.modalEl = document.createElement('div');
    this.modalEl.className = 'modal-backdrop';
    this.modalEl.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <span class="modal-tag"><span class="brand-main">SDWings</span><span class="brand-blue-dot">.</span><span class="brand-main">PDFReader</span> <span class="brand-by">by</span> <span class="brand-sub-brand"><span class="brand-sub-name">SDWings</span><span class="brand-blue-dot">.</span><span class="brand-sub-x">X</span><sup class="brand-sub-reg">®</sup></span> · DIGITAL SIGNATURE</span>
            <h3 class="modal-title">Ký Tên Điện Tử (Signature Pad)</h3>
          </div>
          <button class="modal-close-btn">&times;</button>
        </div>

        <div class="signature-canvas-wrapper">
          <canvas id="sigCanvas" class="signature-pad-canvas" width="600" height="240"></canvas>
          <div class="signature-guideline">Vùng ký tên của kiến trúc sư / kỹ sư phê duyệt</div>
        </div>

        <div class="signature-toolbar">
          <div class="sig-color-options">
            <button class="sig-color-dot active" data-color="#111111" style="background:#111111"></button>
            <button class="sig-color-dot" data-color="#0d47a1" style="background:#0d47a1"></button>
            <button class="sig-color-dot" data-color="#b71c1c" style="background:#b71c1c"></button>
          </div>
          <div class="sig-actions-row">
            <button class="btn-pill btn-light sig-clear-btn">
              <span data-icon="Trash2"></span>
              <span>Xóa chữ ký</span>
            </button>
            <label class="btn-pill btn-light sig-upload-label">
              <span data-icon="Upload"></span>
              <span>Tải ảnh chữ ký (PNG)</span>
              <input type="file" accept="image/png,image/jpeg" style="display:none" class="sig-file-input" />
            </label>
            <button class="btn-pill btn-dark sig-apply-btn">
              <span data-icon="Check"></span>
              <span>Sử Dụng Chữ Ký Này</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.modalEl);
    applyLucideIcons(this.modalEl);

    this.canvas = this.modalEl.querySelector('#sigCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.initCanvas();
    this.bindEvents();
  }

  close() {
    if (this.modalEl && this.modalEl.parentNode) {
      this.modalEl.parentNode.removeChild(this.modalEl);
      this.modalEl = null;
    }
  }

  initCanvas() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = 600 * dpr;
    this.canvas.height = 240 * dpr;
    this.canvas.style.width = '600px';
    this.canvas.style.height = '240px';
    this.ctx.scale(dpr, dpr);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.lineWidth = 2.5;
    this.ctx.strokeStyle = this.color;
  }

  bindEvents() {
    this.modalEl.querySelector('.modal-close-btn').onclick = () => this.close();
    this.modalEl.onclick = (e) => {
      if (e.target === this.modalEl) this.close();
    };

    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    this.canvas.onpointerdown = (e) => {
      this.canvas.setPointerCapture(e.pointerId);
      this.isDrawing = true;
      const pt = getPos(e);
      this.currentStroke = [pt];
      this.ctx.beginPath();
      this.ctx.moveTo(pt.x, pt.y);
    };

    this.canvas.onpointermove = (e) => {
      if (!this.isDrawing) return;
      const pt = getPos(e);
      this.currentStroke.push(pt);
      this.ctx.lineTo(pt.x, pt.y);
      this.ctx.stroke();
    };

    this.canvas.onpointerup = (e) => {
      if (!this.isDrawing) return;
      this.isDrawing = false;
      this.canvas.releasePointerCapture(e.pointerId);
      if (this.currentStroke.length > 0) {
        this.strokes.push([...this.currentStroke]);
      }
    };

    // Colors
    this.modalEl.querySelectorAll('.sig-color-dot').forEach(dot => {
      dot.onclick = () => {
        this.modalEl.querySelectorAll('.sig-color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        this.color = dot.getAttribute('data-color');
        this.ctx.strokeStyle = this.color;
      };
    });

    // Clear
    this.modalEl.querySelector('.sig-clear-btn').onclick = () => {
      this.strokes = [];
      const dpr = window.devicePixelRatio || 1;
      this.ctx.clearRect(0, 0, 600 * dpr, 240 * dpr);
    };

    // File upload
    const fileInput = this.modalEl.querySelector('.sig-file-input');
    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = (rev) => {
          const img = new Image();
          img.onload = () => {
            this.ctx.clearRect(0, 0, 600, 240);
            this.ctx.drawImage(img, 150, 20, 300, 200);
            this.strokes.push([{ x: 0, y: 0 }]); // Mark not empty
          };
          img.src = rev.target.result;
        };
        reader.readAsDataURL(e.target.files[0]);
      }
    };

    // Apply
    this.modalEl.querySelector('.sig-apply-btn').onclick = () => {
      if (this.strokes.length === 0) {
        showToast('Vui lòng ký tên hoặc tải ảnh con dấu trước khi áp dụng.', 'warning');
        return;
      }
      const dataUrl = this.canvas.toDataURL('image/png');
      this.onSave(dataUrl);
      this.close();
      showToast('Đã lưu chữ ký số / con dấu thành công!', 'success');
    };
  }
}

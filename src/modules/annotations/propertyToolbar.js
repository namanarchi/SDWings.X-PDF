/**
 * propertyToolbar.js
 * Contextual floating property toolbar for adjusting colors, stroke widths,
 * corner radiuses, cloud scallops, fonts, opacity sliders, CAD scale, and stamps.
 */

import {
  showFillColorPickerPopover,
  showBorderRadiusPopover,
  showLineWidthPopover,
  showFontPickerPopover,
  showCloudArcPopover,
  showStampPickerPopover,
  showScalePickerPopover,
  closeAllPopovers
} from '../dialogManager.js';
import { getSelectionUIGeometry } from './annotationGeometry.js';

export function getFontShortName(family) {
  if (!family || family === 'sans-serif') return 'Sans';
  if (family.includes('Arial')) return 'Arial';
  if (family.includes('Roboto')) return 'Roboto';
  if (family.includes('Inter')) return 'Inter';
  if (family.includes('Courier') || family.includes('mono')) return 'CAD Mono';
  if (family.includes('Times') || family.includes('serif')) return 'Times';
  if (family.includes('Segoe')) return 'Segoe UI';
  if (family.includes('cursive')) return 'Viết tay';
  return 'Phông';
}

export function hidePropertyToolbar(manager) {
  closeAllPopovers();
  if (manager.propertyToolbarEl) {
    manager.propertyToolbarEl.remove();
    manager.propertyToolbarEl = null;
  }
  manager.propertyToolbarAnnot = null;
}

export function updatePropertyToolbarPosition(manager, overlayCanvas) {
  if (!manager.propertyToolbarEl || !manager.selectedAnnot || !overlayCanvas) return;
  const geom = getSelectionUIGeometry(manager.selectedAnnot, overlayCanvas);
  if (!geom) return;
  const clearance = 48;
  const isNearTop = geom.py < (clearance + 12);
  const topY = isNearTop ? (geom.py + geom.ph + 14) : (geom.py - clearance);
  const leftX = Math.max(6, Math.min(overlayCanvas.width - 360, geom.px));
  manager.propertyToolbarEl.style.top = `${topY}px`;
  manager.propertyToolbarEl.style.left = `${leftX}px`;
}

export function syncPropertyToolbarValues(manager) {
  if (!manager.propertyToolbarEl || !manager.selectedAnnot) return;
  const a = manager.selectedAnnot;
  const toolbar = manager.propertyToolbarEl;

  // 1. Background dot
  const bgDot = toolbar.querySelector('.prop-bg-btn .prop-color-dot');
  if (bgDot) {
    const isTrans = !a.bgColor || a.bgColor === 'transparent' || a.bgColor === 'none';
    bgDot.style.backgroundColor = isTrans ? '' : a.bgColor;
    bgDot.className = isTrans ? 'prop-color-dot transparent-dot' : 'prop-color-dot';
  }

  // 2. Stroke dot & badge
  const strokeDot = toolbar.querySelector('.prop-stroke-btn .prop-color-dot');
  const strokeBadge = toolbar.querySelector('.prop-stroke-btn .prop-val-badge');
  if (strokeDot && strokeBadge) {
    const strokeW = a.size !== undefined ? a.size : (a.type === 'comment' ? 1.5 : 2);
    const isTrans = a.color === 'transparent' || strokeW === 0;
    strokeDot.style.backgroundColor = isTrans ? '' : (a.color || '#111827');
    strokeDot.className = isTrans ? 'prop-color-dot transparent-dot' : 'prop-color-dot';
    strokeBadge.textContent = `${strokeW}px`;
  }

  // 3. Radius badge
  const radiusBadge = toolbar.querySelector('.prop-radius-btn .prop-val-badge');
  if (radiusBadge) {
    const rad = a.borderRadius !== undefined ? a.borderRadius : (a.type === 'comment' ? 8 : 0);
    radiusBadge.textContent = rad >= 100 ? 'Tròn' : `${rad}px`;
  }

  // 4. Cloud arc badge
  const arcBadge = toolbar.querySelector('.prop-cloud-arc-btn .prop-val-badge');
  if (arcBadge) {
    arcBadge.textContent = `${a.arcRadius || 14}px`;
  }

  // 5. Font name
  const fontName = toolbar.querySelector('.prop-font-btn .prop-font-name');
  if (fontName) {
    fontName.textContent = getFontShortName(a.fontFamily || 'sans-serif');
  }

  // 6. Font size & text color
  const stepInput = toolbar.querySelector('.prop-step-val-input');
  if (stepInput && document.activeElement !== stepInput) {
    stepInput.value = a.fontSize || (a.type === 'comment' ? 13 : 14);
  }
  const txtDot = toolbar.querySelector('.prop-text-color-btn .prop-color-dot');
  if (txtDot) {
    txtDot.style.backgroundColor = a.textColor || a.color || (a.type === 'comment' ? '#92400e' : '#111827');
  }

  // 7. Highlighter color & opacity slider
  const hlDot = toolbar.querySelector('.prop-highlight-color-btn .prop-color-dot');
  if (hlDot) {
    hlDot.style.backgroundColor = a.color || '#ffd54f';
  }
  const slider = toolbar.querySelector('.prop-range-slider');
  const sliderValInput = toolbar.querySelector('.prop-slider-val-input');
  if (slider) {
    const op = Math.round((a.opacity !== undefined ? a.opacity : 0.38) * 100);
    slider.value = op;
    if (sliderValInput && document.activeElement !== sliderValInput) {
      sliderValInput.value = op;
    }
  }

  // 8. CAD Scale
  const scaleBtnSpan = toolbar.querySelector('.prop-scale-btn span');
  if (scaleBtnSpan) {
    scaleBtnSpan.textContent = `📐 Tỷ lệ 1:${manager.scaleRatio}`;
  }

  // 9. Stamp
  const stampBtnSpan = toolbar.querySelector('.prop-stamp-picker-btn span:nth-child(2)');
  const stampDot = toolbar.querySelector('.prop-stamp-color-btn .prop-color-dot');
  if (stampBtnSpan) stampBtnSpan.textContent = a.stampText || 'APPROVED';
  if (stampDot) stampDot.style.backgroundColor = a.stampColor || '#2e7d32';

  // 10. Rotation badge
  const rotSpan = toolbar.querySelector('.prop-rotate-btn span');
  if (rotSpan) {
    rotSpan.textContent = `⟳ ${a.rotation || 0}°`;
  }
}

export function renderPropertyToolbar(manager, pageIndex, overlayCanvas) {
  if (!manager.selectedAnnot || manager.selectedPageIndex !== pageIndex) {
    hidePropertyToolbar(manager);
    return;
  }

  const container = overlayCanvas.parentElement;
  if (!container) return;

  const geom = getSelectionUIGeometry(manager.selectedAnnot, overlayCanvas);
  if (!geom) {
    hidePropertyToolbar(manager);
    return;
  }

  const a = manager.selectedAnnot;

  // Zero-flicker: If toolbar is already rendered for this exact annotation, update values in place
  if (manager.propertyToolbarEl && manager.propertyToolbarAnnot === a && manager.propertyToolbarEl.parentElement === container) {
    syncPropertyToolbarValues(manager);
    updatePropertyToolbarPosition(manager, overlayCanvas);
    return;
  }

  let toolbar = manager.propertyToolbarEl;
  if (!toolbar || toolbar.parentElement !== container) {
    if (toolbar) toolbar.remove();
    toolbar = document.createElement('div');
    toolbar.id = 'annotPropertyToolbar';
    toolbar.className = 'annot-property-toolbar';
    toolbar.onpointerdown = (e) => e.stopPropagation();
    toolbar.onmousedown = (e) => e.stopPropagation();
    toolbar.onclick = (e) => e.stopPropagation();
    container.appendChild(toolbar);
    manager.propertyToolbarEl = toolbar;
  }

  manager.propertyToolbarAnnot = a;

  let html = '';
  html += `<span class="prop-toolbar-drag-grip" title="Kéo di chuyển">⋮⋮</span>`;

  // 1. Background Fill button (for comment, rect, text, cloud, shape, curve, or closed pen)
  if (a.type === 'comment' || a.type === 'rect' || a.type === 'text' || a.type === 'cloud' || a.type === 'shape' || a.type === 'curve' || a.isClosed) {
    const isTrans = !a.bgColor || a.bgColor === 'transparent' || a.bgColor === 'none';
    const dotStyle = isTrans ? '' : `background-color: ${a.bgColor};`;
    const dotClass = isTrans ? 'prop-color-dot transparent-dot' : 'prop-color-dot';
    html += `
      <button class="prop-tool-btn prop-bg-btn" title="Chỉnh màu nền ô">
        <span class="${dotClass}" style="${dotStyle}"></span>
        <span>Nền</span>
      </button>
    `;
  }

  // 2. Stroke / Border Line button (for comment, rect, cloud, arrow, pen, ruler, text, image, shape, curve)
  if (a.type === 'comment' || a.type === 'rect' || a.type === 'cloud' || a.type === 'arrow' || a.type === 'pen' || a.type === 'ruler' || a.type === 'text' || a.type === 'image' || a.type === 'shape' || a.type === 'curve') {
    const strokeW = a.size !== undefined ? a.size : (a.type === 'comment' ? 1.5 : (a.type === 'image' ? 0 : 2));
    const isTrans = !a.color || a.color === 'transparent' || strokeW === 0;
    const dotStyle = isTrans ? '' : `background-color: ${a.color || '#111827'};`;
    const dotClass = isTrans ? 'prop-color-dot transparent-dot' : 'prop-color-dot';
    const labelText = (a.type === 'pen' || a.type === 'arrow') ? 'Nét vẽ' : (a.type === 'ruler' ? 'Nét thước' : (a.type === 'image' ? 'Viền ảnh' : (a.type === 'shape' || a.type === 'curve' ? 'Viền hình' : 'Viền')));
    html += `
      <button class="prop-tool-btn prop-stroke-btn" title="Chỉnh đường line & màu nét">
        <span class="${dotClass}" style="${dotStyle}"></span>
        <span>${labelText}</span>
        <span class="prop-val-badge">${strokeW}px</span>
      </button>
    `;
  }

  // 3. Border Radius / Bo góc button (for comment, rect, text, image)
  if (a.type === 'comment' || a.type === 'rect' || a.type === 'text' || a.type === 'image') {
    const rad = a.borderRadius !== undefined ? a.borderRadius : (a.type === 'comment' ? 8 : 0);
    const radLabel = rad >= 100 ? 'Tròn' : `${rad}px`;
    html += `
      <button class="prop-tool-btn prop-radius-btn" title="Chỉnh độ bo tròn góc">
        <span>Bo góc</span>
        <span class="prop-val-badge">${radLabel}</span>
      </button>
    `;
  }

  // 4. Cloud Arc Scallop Radius (for cloud)
  if (a.type === 'cloud') {
    const arcRad = a.arcRadius || 14;
    html += `
      <button class="prop-tool-btn prop-cloud-arc-btn" title="Chỉnh độ cong vòm mây kiến trúc">
        <span>☁ Vòm mây</span>
        <span class="prop-val-badge">${arcRad}px</span>
      </button>
    `;
  }

  // 5. Font family selector (for comment, text)
  if (a.type === 'comment' || a.type === 'text') {
    const curFont = a.fontFamily || 'sans-serif';
    const fontLabel = getFontShortName(curFont);
    html += `
      <button class="prop-tool-btn prop-font-btn" title="Chọn phông chữ">
        <span class="prop-font-icon">🔤</span>
        <span class="prop-font-name">${fontLabel}</span>
        <span class="prop-arrow-notch">▾</span>
      </button>
    `;
  }

  // 6. Font size & Text color & Direct Inline Edit button (for comment, text)
  if (a.type === 'comment' || a.type === 'text') {
    const fs = a.fontSize || (a.type === 'comment' ? 13 : 14);
    const txtColor = a.textColor || a.color || (a.type === 'comment' ? '#92400e' : '#111827');
    html += `
      <div class="prop-stepper-group" title="Cỡ chữ">
        <button class="prop-step-btn prop-step-dec" title="Giảm cỡ chữ">A-</button>
        <input type="number" class="prop-step-val-input" value="${fs}" min="6" max="100" title="Nhấp để nhập trực tiếp cỡ chữ" />
        <button class="prop-step-btn prop-step-inc" title="Tăng cỡ chữ">A+</button>
      </div>
      <button class="prop-tool-btn prop-text-color-btn" title="Màu chữ">
        <span class="prop-color-dot" style="background-color: ${txtColor};"></span>
        <span>Chữ</span>
      </button>
      <button class="prop-tool-btn prop-edit-text-btn" title="Nhập và chỉnh sửa trực tiếp nội dung văn bản">
        <span>✏ Sửa chữ</span>
      </button>
    `;
  }

  // 7. Image, Highlighter, Shape, Curve Opacity Slider ("nút kéo" độ mờ)
  if (a.type === 'highlight' || a.type === 'image' || a.type === 'shape' || a.type === 'curve' || a.isClosed) {
    const defaultOp = (a.type === 'image' || a.type === 'shape' || a.type === 'curve' || a.isClosed) ? 1.0 : 0.38;
    const op = Math.round((a.opacity !== undefined ? a.opacity : defaultOp) * 100);
    if (a.type === 'highlight') {
      const hlColor = a.color || '#ffd54f';
      html += `
        <button class="prop-tool-btn prop-highlight-color-btn" title="Màu bút dạ quang">
          <span class="prop-color-dot" style="background-color: ${hlColor};"></span>
          <span>Màu dạ quang</span>
        </button>
      `;
    }
    html += `
      <div class="prop-slider-group" title="Kéo thanh trượt hoặc nhập số để chỉnh độ mờ (${a.type === 'image' ? 'hình ảnh' : (a.type === 'highlight' ? 'dạ quang' : 'hình vẽ')})">
        <span class="prop-slider-label">Độ mờ</span>
        <input type="range" class="prop-range-slider" min="10" max="100" step="5" value="${op}" />
        <input type="number" class="prop-slider-val-input" min="10" max="100" step="1" value="${op}" title="Nhập % độ mờ" />
        <span class="prop-slider-pct">%</span>
      </div>
    `;
  }

  // 7b. Image Aspect-Ratio Lock & Replace Buttons (for image)
  if (a.type === 'image') {
    const isLocked = a.lockAspectRatio !== false;
    html += `
      <button class="prop-tool-btn prop-aspect-btn" title="Khóa / Mở tỷ lệ kích thước ảnh khi kéo co giãn">
        <span>${isLocked ? '🔒 Khóa tỷ lệ' : '🔓 Tự do'}</span>
      </button>
      <button class="prop-tool-btn prop-replace-img-btn" title="Chọn hình ảnh khác thay thế">
        <span>🖼 Đổi ảnh</span>
      </button>
    `;
  }

  // 8. CAD Scale & Text size for Ruler (for ruler)
  if (a.type === 'ruler') {
    const fs = a.fontSize || 12;
    html += `
      <button class="prop-tool-btn prop-scale-btn" title="Đổi tỷ lệ CAD">
        <span>📐 Tỷ lệ 1:${manager.scaleRatio}</span>
      </button>
      <div class="prop-stepper-group" title="Cỡ số đo">
        <button class="prop-step-btn prop-step-dec" title="Giảm cỡ số đo">A-</button>
        <input type="number" class="prop-step-val-input" value="${fs}" min="6" max="100" title="Nhấp để nhập trực tiếp cỡ số đo" />
        <button class="prop-step-btn prop-step-inc" title="Tăng cỡ số đo">A+</button>
      </div>
    `;
  }

  // 9. Stamp Picker & Color (for stamp)
  if (a.type === 'stamp') {
    const stampText = a.stampText || 'APPROVED';
    const stampCol = a.stampColor || '#2e7d32';
    html += `
      <button class="prop-tool-btn prop-stamp-picker-btn" title="Chọn con dấu khác">
        <span class="prop-stamp-icon">🖃</span>
        <span>${stampText}</span>
        <span class="prop-arrow-notch">▾</span>
      </button>
      <button class="prop-tool-btn prop-stamp-color-btn" title="Đổi màu con dấu">
        <span class="prop-color-dot" style="background-color: ${stampCol};"></span>
        <span>Màu dấu</span>
      </button>
    `;
  }

  // 10. Signature Re-sign (for signature)
  if (a.type === 'signature') {
    html += `
      <button class="prop-tool-btn prop-re-sign-btn" title="Ký lại hoặc đổi mẫu chữ ký mới">
        <span>✍ Đổi chữ ký</span>
      </button>
    `;
  }

  // 10b. Rotate Object button
  const rotDeg = a.rotation || 0;
  html += `
    <button class="prop-tool-btn prop-rotate-btn" title="Xoay nhanh +90° theo chiều kim đồng hồ (hoặc kéo nút tròn xoay trên đỉnh đối tượng)">
      <span>⟳ ${rotDeg}°</span>
    </button>
  `;

  html += `<span class="prop-toolbar-divider"></span>`;

  // 11. Delete button (Only Red X)
  html += `
    <button class="prop-del-btn" title="Xóa đối tượng (Delete / Backspace)">
      <span>✕</span>
    </button>
  `;

  toolbar.innerHTML = html;

  const clearance = 48;
  const isNearTop = geom.py < (clearance + 12);
  const topY = isNearTop ? (geom.py + geom.ph + 14) : (geom.py - clearance);
  const leftX = Math.max(6, Math.min(overlayCanvas.width - 360, geom.px));
  toolbar.style.top = `${topY}px`;
  toolbar.style.left = `${leftX}px`;

  // 1. Background Fill click handler
  const bgBtn = toolbar.querySelector('.prop-bg-btn');
  if (bgBtn) {
    bgBtn.onclick = (e) => {
      e.stopPropagation();
      showFillColorPickerPopover({
        anchorEl: bgBtn,
        currentColor: a.bgColor || (a.type === 'comment' ? '#fef3c7' : 'transparent'),
        onSelect: (col) => {
          const oldBg = a.bgColor || 'transparent';
          if (oldBg !== col) {
            manager.recordModify(pageIndex, a, { bgColor: oldBg }, { bgColor: col });
            a.bgColor = col;
            manager.drawPageOverlay(pageIndex, overlayCanvas);
            syncPropertyToolbarValues(manager);
            updatePropertyToolbarPosition(manager, overlayCanvas);
          }
        }
      });
    };
  }

  // 2. Stroke / Line click handler
  const strokeBtn = toolbar.querySelector('.prop-stroke-btn');
  if (strokeBtn) {
    strokeBtn.onclick = (e) => {
      e.stopPropagation();
      showLineWidthPopover({
        anchorEl: strokeBtn,
        currentColor: a.color || (a.type === 'cloud' ? '#d32f2f' : (a.type === 'comment' ? '#f59e0b' : '#111827')),
        currentWidth: a.size !== undefined ? a.size : (a.type === 'comment' ? 1.5 : 2),
        onSelectWidth: (w) => {
          const oldW = a.size !== undefined ? a.size : (a.type === 'comment' ? 1.5 : 2);
          if (oldW !== w) {
            manager.recordModify(pageIndex, a, { size: oldW }, { size: w });
            a.size = w;
            manager.drawPageOverlay(pageIndex, overlayCanvas);
            syncPropertyToolbarValues(manager);
            updatePropertyToolbarPosition(manager, overlayCanvas);
          }
        },
        onSelectColor: (c) => {
          const oldC = a.color || '#111827';
          if (oldC !== c) {
            manager.recordModify(pageIndex, a, { color: oldC }, { color: c });
            a.color = c;
            manager.drawPageOverlay(pageIndex, overlayCanvas);
            syncPropertyToolbarValues(manager);
            updatePropertyToolbarPosition(manager, overlayCanvas);
          }
        }
      });
    };
  }

  // 3. Border Radius click handler
  const radiusBtn = toolbar.querySelector('.prop-radius-btn');
  if (radiusBtn) {
    radiusBtn.onclick = (e) => {
      e.stopPropagation();
      showBorderRadiusPopover({
        anchorEl: radiusBtn,
        currentRadius: a.borderRadius !== undefined ? a.borderRadius : (a.type === 'comment' ? 8 : 0),
        onSelect: (rad) => {
          const oldRad = a.borderRadius !== undefined ? a.borderRadius : (a.type === 'comment' ? 8 : 0);
          if (oldRad !== rad) {
            manager.recordModify(pageIndex, a, { borderRadius: oldRad }, { borderRadius: rad });
            a.borderRadius = rad;
            manager.drawPageOverlay(pageIndex, overlayCanvas);
            syncPropertyToolbarValues(manager);
            updatePropertyToolbarPosition(manager, overlayCanvas);
          }
        }
      });
    };
  }

  // 4. Cloud Arc Scallop click handler
  const cloudArcBtn = toolbar.querySelector('.prop-cloud-arc-btn');
  if (cloudArcBtn) {
    cloudArcBtn.onclick = (e) => {
      e.stopPropagation();
      showCloudArcPopover({
        anchorEl: cloudArcBtn,
        currentArcRadius: a.arcRadius || 14,
        onSelect: (arc) => {
          const oldArc = a.arcRadius || 14;
          if (oldArc !== arc) {
            manager.recordModify(pageIndex, a, { arcRadius: oldArc }, { arcRadius: arc });
            a.arcRadius = arc;
            manager.drawPageOverlay(pageIndex, overlayCanvas);
            syncPropertyToolbarValues(manager);
            updatePropertyToolbarPosition(manager, overlayCanvas);
          }
        }
      });
    };
  }

  // 5. Font picker click handler
  const fontBtn = toolbar.querySelector('.prop-font-btn');
  if (fontBtn) {
    fontBtn.onclick = (e) => {
      e.stopPropagation();
      showFontPickerPopover({
        anchorEl: fontBtn,
        currentFont: a.fontFamily || 'sans-serif',
        onSelect: (font) => {
          const oldFont = a.fontFamily || 'sans-serif';
          if (oldFont !== font) {
            manager.recordModify(pageIndex, a, { fontFamily: oldFont }, { fontFamily: font });
            a.fontFamily = font;
            manager.drawPageOverlay(pageIndex, overlayCanvas);
            syncPropertyToolbarValues(manager);
            updatePropertyToolbarPosition(manager, overlayCanvas);
          }
        }
      });
    };
  }

  // 6. Font size stepper & direct input handler
  const decBtn = toolbar.querySelector('.prop-step-dec');
  const incBtn = toolbar.querySelector('.prop-step-inc');
  const stepInput = toolbar.querySelector('.prop-step-val-input');

  if (stepInput) {
    stepInput.onpointerdown = (e) => e.stopPropagation();
    stepInput.onmousedown = (e) => e.stopPropagation();
    stepInput.onclick = (e) => e.stopPropagation();
    stepInput.onkeydown = (e) => e.stopPropagation();
    stepInput.oninput = (e) => {
      e.stopPropagation();
      const val = parseInt(stepInput.value, 10);
      if (!isNaN(val) && val >= 6 && val <= 120) {
        a.fontSize = val;
        manager.drawPageOverlay(pageIndex, overlayCanvas);
        updatePropertyToolbarPosition(manager, overlayCanvas);
      }
    };
    stepInput.onchange = (e) => {
      e.stopPropagation();
      const val = parseInt(stepInput.value, 10);
      if (!isNaN(val) && val >= 6 && val <= 120) {
        const cur = a.fontSize || 14;
        manager.recordModify(pageIndex, a, { fontSize: cur }, { fontSize: val });
        a.fontSize = val;
        manager.drawPageOverlay(pageIndex, overlayCanvas);
        updatePropertyToolbarPosition(manager, overlayCanvas);
      }
    };
  }

  if (decBtn && incBtn) {
    decBtn.onclick = (e) => {
      e.stopPropagation();
      const cur = a.fontSize || (a.type === 'comment' ? 13 : 14);
      const next = Math.max(8, cur - 1);
      if (cur !== next) {
        manager.recordModify(pageIndex, a, { fontSize: cur }, { fontSize: next });
        a.fontSize = next;
        if (stepInput) stepInput.value = next;
        manager.drawPageOverlay(pageIndex, overlayCanvas);
        updatePropertyToolbarPosition(manager, overlayCanvas);
      }
    };
    incBtn.onclick = (e) => {
      e.stopPropagation();
      const cur = a.fontSize || (a.type === 'comment' ? 13 : 14);
      const next = Math.min(80, cur + 1);
      if (cur !== next) {
        manager.recordModify(pageIndex, a, { fontSize: cur }, { fontSize: next });
        a.fontSize = next;
        if (stepInput) stepInput.value = next;
        manager.drawPageOverlay(pageIndex, overlayCanvas);
        updatePropertyToolbarPosition(manager, overlayCanvas);
      }
    };
  }

  // 7. Text color click handler
  const textColorBtn = toolbar.querySelector('.prop-text-color-btn');
  if (textColorBtn) {
    textColorBtn.onclick = (e) => {
      e.stopPropagation();
      showFillColorPickerPopover({
        anchorEl: textColorBtn,
        currentColor: a.textColor || a.color || (a.type === 'comment' ? '#92400e' : '#111827'),
        onSelect: (col) => {
          const oldCol = a.textColor || a.color || (a.type === 'comment' ? '#92400e' : '#111827');
          if (oldCol !== col) {
            manager.recordModify(pageIndex, a, { textColor: oldCol }, { textColor: col });
            a.textColor = col;
            manager.drawPageOverlay(pageIndex, overlayCanvas);
            syncPropertyToolbarValues(manager);
            updatePropertyToolbarPosition(manager, overlayCanvas);
          }
        }
      });
    };
  }

  // 8. Direct Inline Text Edit button handler
  const editTextBtn = toolbar.querySelector('.prop-edit-text-btn');
  if (editTextBtn) {
    editTextBtn.onclick = (e) => {
      e.stopPropagation();
      manager.startDirectInlineEdit(pageIndex, overlayCanvas, a);
    };
  }

  // 9. Highlighter color & opacity slider handlers ("nút kéo" độ mờ)
  const hlColorBtn = toolbar.querySelector('.prop-highlight-color-btn');
  if (hlColorBtn) {
    hlColorBtn.onclick = (e) => {
      e.stopPropagation();
      showFillColorPickerPopover({
        anchorEl: hlColorBtn,
        currentColor: a.color || '#ffd54f',
        onSelect: (col) => {
          const oldCol = a.color || '#ffd54f';
          if (oldCol !== col) {
            manager.recordModify(pageIndex, a, { color: oldCol }, { color: col });
            a.color = col;
            manager.drawPageOverlay(pageIndex, overlayCanvas);
            syncPropertyToolbarValues(manager);
            updatePropertyToolbarPosition(manager, overlayCanvas);
          }
        }
      });
    };
  }
  const slider = toolbar.querySelector('.prop-range-slider');
  const sliderValInput = toolbar.querySelector('.prop-slider-val-input');
  if (slider) {
    let origOp = a.opacity !== undefined ? a.opacity : 0.38;
    slider.onpointerdown = (e) => e.stopPropagation();
    slider.onmousedown = (e) => e.stopPropagation();
    slider.oninput = (e) => {
      e.stopPropagation();
      const val = parseInt(slider.value, 10);
      a.opacity = val / 100;
      if (sliderValInput && document.activeElement !== sliderValInput) {
        sliderValInput.value = val;
      }
      manager.drawPageOverlay(pageIndex, overlayCanvas);
    };
    slider.onchange = (e) => {
      e.stopPropagation();
      const val = parseInt(slider.value, 10);
      const newOp = val / 100;
      if (origOp !== newOp) {
        manager.recordModify(pageIndex, a, { opacity: origOp }, { opacity: newOp });
        origOp = newOp;
      }
      manager.onStateChange({ dirty: true });
    };

    if (sliderValInput) {
      sliderValInput.onpointerdown = (e) => e.stopPropagation();
      sliderValInput.onmousedown = (e) => e.stopPropagation();
      sliderValInput.onclick = (e) => e.stopPropagation();
      sliderValInput.onkeydown = (e) => e.stopPropagation();
      sliderValInput.oninput = (e) => {
        e.stopPropagation();
        const val = parseInt(sliderValInput.value, 10);
        if (!isNaN(val) && val >= 5 && val <= 100) {
          a.opacity = val / 100;
          slider.value = val;
          manager.drawPageOverlay(pageIndex, overlayCanvas);
        }
      };
      sliderValInput.onchange = (e) => {
        e.stopPropagation();
        const val = parseInt(sliderValInput.value, 10);
        if (!isNaN(val) && val >= 5 && val <= 100) {
          const newOp = val / 100;
          if (origOp !== newOp) {
            manager.recordModify(pageIndex, a, { opacity: origOp }, { opacity: newOp });
            origOp = newOp;
          }
          a.opacity = newOp;
          slider.value = val;
          manager.drawPageOverlay(pageIndex, overlayCanvas);
          manager.onStateChange({ dirty: true });
        }
      };
    }
  }

  // 10. Ruler CAD Scale click handler
  const scaleBtn = toolbar.querySelector('.prop-scale-btn');
  if (scaleBtn) {
    scaleBtn.onclick = (e) => {
      e.stopPropagation();
      showScalePickerPopover({
        anchorEl: scaleBtn,
        currentRatio: manager.scaleRatio,
        onSelect: (r) => {
          const oldR = manager.scaleRatio;
          manager.setScaleRatio(r, 'm');
          if (a.type === 'ruler') {
            const oldLabel = a.label;
            const dist = getSelectionUIGeometry(a, overlayCanvas);
            if (dist) {
              // Recalculate ruler measurement
              // Will be updated via computeCadMeasurement
            }
            manager.recordModify(pageIndex, a, { scaleRatio: oldR }, { scaleRatio: r });
          }
          manager.drawPageOverlay(pageIndex, overlayCanvas);
          syncPropertyToolbarValues(manager);
          updatePropertyToolbarPosition(manager, overlayCanvas);
        }
      });
    };
  }

  // 11. Stamp picker & color handlers
  const stampPickerBtn = toolbar.querySelector('.prop-stamp-picker-btn');
  if (stampPickerBtn) {
    stampPickerBtn.onclick = (e) => {
      e.stopPropagation();
      showStampPickerPopover({
        anchorEl: stampPickerBtn,
        onSelect: (text, col) => {
          const oldT = a.stampText;
          const oldC = a.stampColor;
          manager.recordModify(pageIndex, a, { stampText: oldT, stampColor: oldC }, { stampText: text, stampColor: col });
          a.stampText = text;
          a.stampColor = col;
          manager.drawPageOverlay(pageIndex, overlayCanvas);
          syncPropertyToolbarValues(manager);
          updatePropertyToolbarPosition(manager, overlayCanvas);
        }
      });
    };
  }
  const stampColorBtn = toolbar.querySelector('.prop-stamp-color-btn');
  if (stampColorBtn) {
    stampColorBtn.onclick = (e) => {
      e.stopPropagation();
      showFillColorPickerPopover({
        anchorEl: stampColorBtn,
        currentColor: a.stampColor || '#2e7d32',
        onSelect: (col) => {
          const oldC = a.stampColor || '#2e7d32';
          if (oldC !== col) {
            manager.recordModify(pageIndex, a, { stampColor: oldC }, { stampColor: col });
            a.stampColor = col;
            manager.drawPageOverlay(pageIndex, overlayCanvas);
            syncPropertyToolbarValues(manager);
            updatePropertyToolbarPosition(manager, overlayCanvas);
          }
        }
      });
    };
  }

  // 12. Signature Re-sign handler
  const reSignBtn = toolbar.querySelector('.prop-re-sign-btn');
  if (reSignBtn) {
    reSignBtn.onclick = (e) => {
      e.stopPropagation();
      manager.onRequestSignature(a);
    };
  }

  // 12b. Image Aspect-Ratio and Replace handlers
  const aspectBtn = toolbar.querySelector('.prop-aspect-btn');
  if (aspectBtn) {
    aspectBtn.onclick = (e) => {
      e.stopPropagation();
      a.lockAspectRatio = a.lockAspectRatio === false ? true : false;
      const span = aspectBtn.querySelector('span');
      if (span) span.textContent = a.lockAspectRatio ? '🔒 Khóa tỷ lệ' : '🔓 Tự do';
    };
  }

  const replaceImgBtn = toolbar.querySelector('.prop-replace-img-btn');
  if (replaceImgBtn) {
    replaceImgBtn.onclick = (e) => {
      e.stopPropagation();
      const input = document.getElementById('imageFileInput');
      if (input) {
        input.onchange = (ev) => {
          if (ev.target.files && ev.target.files[0]) {
            const reader = new FileReader();
            reader.onload = () => {
              const oldUrl = a.dataUrl;
              a.dataUrl = reader.result;
              a._cachedImg = null;
              manager.recordModify(pageIndex, a, { dataUrl: oldUrl }, { dataUrl: reader.result });
              manager.drawPageOverlay(pageIndex, overlayCanvas);
            };
            reader.readAsDataURL(ev.target.files[0]);
            input.value = '';
          }
        };
        input.click();
      }
    };
  }

  // 12c. Rotate button handler
  const rotateBtn = toolbar.querySelector('.prop-rotate-btn');
  if (rotateBtn) {
    rotateBtn.onclick = (e) => {
      e.stopPropagation();
      const oldRot = a.rotation || 0;
      const newRot = (oldRot + 90) % 360;
      manager.recordModify(pageIndex, a, { rotation: oldRot }, { rotation: newRot });
      a.rotation = newRot;
      manager.drawPageOverlay(pageIndex, overlayCanvas);
      syncPropertyToolbarValues(manager);
      updatePropertyToolbarPosition(manager, overlayCanvas);
    };
  }

  // 13. Delete button handler
  const delBtn = toolbar.querySelector('.prop-del-btn');
  if (delBtn) {
    delBtn.onclick = (e) => {
      e.stopPropagation();
      manager.deleteSelectedAnnotation();
      manager.drawPageOverlay(pageIndex, overlayCanvas);
    };
  }
}

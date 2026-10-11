/**
 * toolPopovers.js
 * Architectural popovers: Stamp picker, CAD Scale ratio selector, and Font family picker.
 * Enhanced with robust input event containment & safe outside-click management.
 */

import { closeAllPopovers, positionPopover, attachSafeOutsideClick } from './popoverBase.js';
import { FONT_FAMILIES } from './paletteConstants.js';

/**
 * Architectural Stamp Popover
 * Opens a palette with visual stamps: APPROVED, DRAFT, REVISED, REJECTED, and custom stamp entry
 */
export function showStampPickerPopover({ anchorEl, onSelect }) {
  const existing = document.getElementById('stampPickerPopover');
  closeAllPopovers();
  if (existing) return;

  const popover = document.createElement('div');
  popover.id = 'stampPickerPopover';
  popover.className = 'stamp-popover';

  const stamps = [
    { label: 'APPROVED', color: '#2e7d32', desc: 'Đã phê duyệt đạt chuẩn kỹ thuật' },
    { label: 'DRAFT', color: '#616161', desc: 'Bản vẽ phác thảo sơ bộ' },
    { label: 'REVISED', color: '#1565c0', desc: 'Đã chỉnh sửa theo yêu cầu' },
    { label: 'REJECTED', color: '#d32f2f', desc: 'Không đạt tiêu chuẩn kiểm tra' }
  ];

  const itemsHtml = stamps.map(s => `
    <div class="stamp-option-item" data-stamp="${s.label}" data-color="${s.color}">
      <span class="stamp-preview-tag" style="border-color: ${s.color}; color: ${s.color};">
        ${s.label}
      </span>
      <span class="stamp-option-desc">${s.desc}</span>
    </div>
  `).join('');

  popover.innerHTML = `
    <div class="stamp-popover-header">
      <span class="stamp-popover-title">Chọn Con Dấu (Architectural Stamp)</span>
    </div>
    <div class="stamp-options-list">
      ${itemsHtml}
    </div>
    <div class="stamp-custom-row">
      <input type="text" class="stamp-custom-input" placeholder="Con dấu tùy chỉnh..." />
      <button class="stamp-custom-btn btn-pill btn-dark">Dùng</button>
    </div>
  `;

  positionPopover(popover, anchorEl, 280);

  popover.querySelectorAll('.stamp-option-item').forEach(item => {
    item.onclick = (e) => {
      e.stopPropagation();
      const stampText = item.getAttribute('data-stamp');
      const stampColor = item.getAttribute('data-color');
      popover.remove();
      onSelect(stampText, stampColor);
    };
  });

  const customInput = popover.querySelector('.stamp-custom-input');
  const customBtn = popover.querySelector('.stamp-custom-btn');
  const applyCustom = () => {
    const text = customInput.value.trim();
    if (text) {
      popover.remove();
      onSelect(text, '#1e3a5f');
    }
  };

  if (customInput) {
    customInput.onpointerdown = (e) => e.stopPropagation();
    customInput.onmousedown = (e) => e.stopPropagation();
    customInput.onclick = (e) => e.stopPropagation();
    customInput.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') applyCustom();
    };
  }

  if (customBtn) {
    customBtn.onclick = (e) => {
      e.stopPropagation();
      applyCustom();
    };
  }

  attachSafeOutsideClick(popover, anchorEl);
  document.body.appendChild(popover);
}

/**
 * CAD Scale Picker Popover
 * Opens preset scale choices: 1:20, 1:50, 1:100, 1:200, 1:500 or custom ratio
 */
export function showScalePickerPopover({ anchorEl, currentRatio, onSelect }) {
  const existing = document.getElementById('scalePickerPopover');
  closeAllPopovers();
  if (existing) return;

  const popover = document.createElement('div');
  popover.id = 'scalePickerPopover';
  popover.className = 'scale-popover';

  const presets = [20, 50, 100, 200, 500];
  const pillsHtml = presets.map(p => `
    <button class="scale-preset-pill ${currentRatio === p ? 'active' : ''}" data-scale="${p}">
      1:${p}
    </button>
  `).join('');

  popover.innerHTML = `
    <div class="scale-popover-title">Tỷ Lệ Thước CAD</div>
    <div class="scale-presets-grid">
      ${pillsHtml}
    </div>
    <div class="scale-custom-row">
      <span class="scale-prefix">1 :</span>
      <input type="number" class="scale-custom-input" placeholder="Tùy chỉnh" value="${currentRatio}" />
      <button class="scale-custom-apply btn-pill btn-dark">Lưu</button>
    </div>
  `;

  positionPopover(popover, anchorEl, 240);

  popover.querySelectorAll('.scale-preset-pill').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const s = parseInt(btn.getAttribute('data-scale'), 10);
      popover.remove();
      onSelect(s);
    };
  });

  const customInput = popover.querySelector('.scale-custom-input');
  const customApply = popover.querySelector('.scale-custom-apply');
  const applyCustom = () => {
    const val = parseInt(customInput.value, 10);
    if (!isNaN(val) && val > 0) {
      popover.remove();
      onSelect(val);
    }
  };

  if (customInput) {
    customInput.onpointerdown = (e) => e.stopPropagation();
    customInput.onmousedown = (e) => e.stopPropagation();
    customInput.onclick = (e) => e.stopPropagation();
    customInput.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') applyCustom();
    };
    customInput.oninput = (e) => {
      e.stopPropagation();
      const val = parseInt(customInput.value, 10);
      if (!isNaN(val) && val > 0) {
        onSelect(val);
      }
    };
  }

  if (customApply) {
    customApply.onclick = (e) => {
      e.stopPropagation();
      applyCustom();
    };
  }

  attachSafeOutsideClick(popover, anchorEl);
  document.body.appendChild(popover);
}

/**
 * Font Family Picker Popover
 */
export function showFontPickerPopover({ anchorEl, currentFont = 'sans-serif', onSelect = () => {} }) {
  const existing = document.getElementById('fontPickerPopover');
  closeAllPopovers();
  if (existing) return;

  const popover = document.createElement('div');
  popover.id = 'fontPickerPopover';
  popover.className = 'font-picker-popover';

  const normCurrent = (currentFont || 'sans-serif').toLowerCase();

  const itemsHtml = FONT_FAMILIES.map(f => {
    const isSelected = normCurrent === f.value.toLowerCase() || 
      (normCurrent.includes(f.value.toLowerCase().split(',')[0].replace(/['"]/g, '')) && f.value !== 'sans-serif');
    return `
      <button class="font-preset-row ${isSelected ? 'active' : ''}" data-font="${f.value}">
        <div class="font-preset-info">
          <div class="font-preset-top">
            <span class="font-preset-label">${f.label}</span>
            <span class="font-preset-sample" style="font-family: ${f.family};">${f.sample}</span>
          </div>
          <span class="font-preset-desc">${f.desc}</span>
        </div>
        ${isSelected ? '<span class="font-check">✓</span>' : ''}
      </button>
    `;
  }).join('');

  popover.innerHTML = `
    <div class="palette-popover-header">
      <span class="palette-popover-title">Kiểu Phông Chữ (Font Family)</span>
    </div>
    <div class="font-presets-list">
      ${itemsHtml}
    </div>
  `;

  positionPopover(popover, anchorEl, 260);

  popover.querySelectorAll('.font-preset-row').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const font = btn.getAttribute('data-font');
      popover.remove();
      onSelect(font);
    };
  });

  attachSafeOutsideClick(popover, anchorEl);
  document.body.appendChild(popover);
}

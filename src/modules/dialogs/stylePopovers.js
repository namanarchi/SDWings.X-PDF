/**
 * stylePopovers.js
 * Styling popovers: Color & stroke weight, Background fill, Border radius, Line weight, and Cloud arc scalloping.
 * Enhanced with direct custom numeric input & safe outside-click handling.
 */

import { closeAllPopovers, positionPopover, attachSafeOutsideClick } from './popoverBase.js';
import { PALETTE_COLORS, STROKE_WEIGHTS, isLightColor } from './paletteConstants.js';

/**
 * Color & Stroke Weight Popover (Matching User Screenshot)
 */
export function showColorAndStrokePopover({
  anchorEl,
  currentColor = '#f5a623',
  currentStroke = 2,
  onSelectColor = () => {},
  onSelectStroke = () => {}
}) {
  const existing = document.getElementById('colorStrokePopover');
  closeAllPopovers();
  if (existing) return;

  const popover = document.createElement('div');
  popover.id = 'colorStrokePopover';
  popover.className = 'color-stroke-popover';

  const normCurrent = (currentColor || '#f5a623').toLowerCase();

  const swatchesHtml = PALETTE_COLORS.map(c => {
    const isSelected = normCurrent === c.toLowerCase();
    const light = isLightColor(c);
    const checkColor = light ? '#111827' : '#ffffff';
    return `
      <button class="palette-swatch-btn ${isSelected ? 'active' : ''}" data-color="${c}" style="background-color: ${c};" title="${c}">
        ${isSelected ? `<span class="swatch-check-mark" style="color: ${checkColor};">✓</span>` : ''}
      </button>
    `;
  }).join('');

  const strokesHtml = STROKE_WEIGHTS.map(s => {
    const isSelected = currentStroke === s.value;
    return `
      <button class="stroke-preset-btn ${isSelected ? 'active' : ''}" data-weight="${s.value}" title="Nét ${s.label}">
        <div class="stroke-preview-bar" style="height: ${s.value}px; background-color: ${normCurrent};"></div>
        <span class="stroke-preset-label">${s.label}</span>
      </button>
    `;
  }).join('');

  popover.innerHTML = `
    <div class="palette-popover-header">
      <span class="palette-popover-title">Highlight color</span>
    </div>
    <div class="palette-swatches-grid">
      ${swatchesHtml}
    </div>
    <div class="palette-divider"></div>
    <div class="palette-section-sub">
      <span class="palette-sub-title">Độ dày nét vẽ (Stroke weight)</span>
    </div>
    <div class="palette-stroke-grid">
      ${strokesHtml}
    </div>
    <div class="palette-divider"></div>
    <div class="palette-custom-input-row">
      <span class="custom-input-label">Tùy chỉnh:</span>
      <input type="number" class="custom-number-input stroke-custom-input" min="0.5" max="50" step="0.5" value="${currentStroke}" placeholder="vd: 2.5" />
      <span class="custom-input-unit">px</span>
      <button class="custom-input-apply btn-pill btn-dark">Lưu</button>
    </div>
  `;

  const rect = anchorEl.getBoundingClientRect();
  if (rect.left < 120) {
    popover.style.top = `${Math.max(16, Math.min(window.innerHeight - 340, rect.top - 10))}px`;
    popover.style.left = `${rect.right + 12}px`;
  } else {
    positionPopover(popover, anchorEl, 280);
  }

  // Color selection click handlers
  popover.querySelectorAll('.palette-swatch-btn').forEach(btn => {
    btn.onclick = () => {
      const color = btn.getAttribute('data-color');
      popover.querySelectorAll('.palette-swatch-btn').forEach(b => {
        b.classList.remove('active');
        b.innerHTML = '';
      });
      btn.classList.add('active');
      const light = isLightColor(color);
      btn.innerHTML = `<span class="swatch-check-mark" style="color: ${light ? '#111827' : '#ffffff'};">✓</span>`;
      
      // Update preview bars
      popover.querySelectorAll('.stroke-preview-bar').forEach(bar => {
        bar.style.backgroundColor = color;
      });

      onSelectColor(color);
    };
  });

  // Stroke selection click handlers
  popover.querySelectorAll('.stroke-preset-btn').forEach(btn => {
    btn.onclick = () => {
      const w = parseInt(btn.getAttribute('data-weight'), 10);
      popover.querySelectorAll('.stroke-preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const customInp = popover.querySelector('.stroke-custom-input');
      if (customInp) customInp.value = w;
      onSelectStroke(w);
    };
  });

  // Custom stroke number input handlers
  const customInp = popover.querySelector('.stroke-custom-input');
  const customApply = popover.querySelector('.custom-input-apply');
  if (customInp) {
    customInp.onpointerdown = (e) => e.stopPropagation();
    customInp.onmousedown = (e) => e.stopPropagation();
    customInp.onclick = (e) => e.stopPropagation();
    customInp.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') applyCustomStroke();
    };
    customInp.oninput = (e) => {
      e.stopPropagation();
      const val = parseFloat(customInp.value);
      if (!isNaN(val) && val > 0) {
        onSelectStroke(val);
      }
    };
    const applyCustomStroke = () => {
      const val = parseFloat(customInp.value);
      if (!isNaN(val) && val > 0) {
        onSelectStroke(val);
        popover.remove();
      }
    };
    if (customApply) {
      customApply.onclick = (e) => {
        e.stopPropagation();
        applyCustomStroke();
      };
    }
  }

  attachSafeOutsideClick(popover, anchorEl);
  document.body.appendChild(popover);
}

/**
 * Fill / Background Color Picker Popover
 * Includes "Trong suốt" (no fill) and 21 standard palette swatches
 */
export function showFillColorPickerPopover({ anchorEl, currentColor = '#fef3c7', onSelect = () => {} }) {
  const existing = document.getElementById('fillColorPopover');
  closeAllPopovers();
  if (existing) return;

  const popover = document.createElement('div');
  popover.id = 'fillColorPopover';
  popover.className = 'color-stroke-popover fill-color-popover';

  const isTransparent = !currentColor || currentColor === 'transparent' || currentColor === 'none';
  const normCurrent = (currentColor || '').toLowerCase();

  const swatchesHtml = PALETTE_COLORS.map(c => {
    const isSelected = !isTransparent && normCurrent === c.toLowerCase();
    const light = isLightColor(c);
    const checkColor = light ? '#111827' : '#ffffff';
    return `
      <button class="palette-swatch-btn ${isSelected ? 'active' : ''}" data-color="${c}" style="background-color: ${c};" title="${c}">
        ${isSelected ? `<span class="swatch-check-mark" style="color: ${checkColor};">✓</span>` : ''}
      </button>
    `;
  }).join('');

  popover.innerHTML = `
    <div class="palette-popover-header">
      <span class="palette-popover-title">Màu Nền (Background Fill)</span>
    </div>
    <div class="fill-transparent-row">
      <button class="fill-transparent-btn ${isTransparent ? 'active' : ''}">
        <span class="transparent-checker-icon"></span>
        <span class="transparent-label">Trong Suốt (Không Nền)</span>
        ${isTransparent ? '<span class="swatch-check-mark">✓</span>' : ''}
      </button>
    </div>
    <div class="palette-divider"></div>
    <div class="palette-section-sub">
      <span class="palette-sub-title">Bảng màu tiêu chuẩn</span>
    </div>
    <div class="palette-swatches-grid">
      ${swatchesHtml}
    </div>
  `;

  positionPopover(popover, anchorEl, 240);

  popover.querySelector('.fill-transparent-btn').onclick = (e) => {
    e.stopPropagation();
    popover.remove();
    onSelect('transparent');
  };

  popover.querySelectorAll('.palette-swatch-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const col = btn.getAttribute('data-color');
      popover.remove();
      onSelect(col);
    };
  });

  attachSafeOutsideClick(popover, anchorEl);
  document.body.appendChild(popover);
}

/**
 * Border Radius Popover (Bo góc)
 * Options: 0px (Vuông), 4px (Bo nhẹ), 8px (Bo vừa), 14px (Bo cong), 24px (Bo lớn), 999px (Tròn hoàn toàn)
 * Enhanced with custom numeric input
 */
export function showBorderRadiusPopover({ anchorEl, currentRadius = 8, onSelect = () => {} }) {
  const existing = document.getElementById('borderRadiusPopover');
  closeAllPopovers();
  if (existing) return;

  const popover = document.createElement('div');
  popover.id = 'borderRadiusPopover';
  popover.className = 'radius-popover';

  const presets = [
    { value: 0, label: '0px', name: 'Vuông góc', previewRadius: '0px' },
    { value: 4, label: '4px', name: 'Bo nhẹ', previewRadius: '4px' },
    { value: 8, label: '8px', name: 'Bo vừa', previewRadius: '8px' },
    { value: 14, label: '14px', name: 'Bo cong', previewRadius: '14px' },
    { value: 24, label: '24px', name: 'Bo lớn', previewRadius: '20px' },
    { value: 999, label: 'Tròn', name: 'Viên thuốc (Pill)', previewRadius: '999px' }
  ];

  const itemsHtml = presets.map(p => {
    const isSelected = (currentRadius >= 100 && p.value >= 100) || currentRadius === p.value;
    return `
      <button class="radius-preset-row ${isSelected ? 'active' : ''}" data-radius="${p.value}">
        <div class="radius-preview-box" style="border-radius: ${p.previewRadius};"></div>
        <div class="radius-preset-info">
          <span class="radius-preset-val">${p.label}</span>
          <span class="radius-preset-name">${p.name}</span>
        </div>
        ${isSelected ? '<span class="radius-check">✓</span>' : ''}
      </button>
    `;
  }).join('');

  popover.innerHTML = `
    <div class="palette-popover-header">
      <span class="palette-popover-title">Độ Bo Tròn Góc (Border Radius)</span>
    </div>
    <div class="radius-presets-list">
      ${itemsHtml}
    </div>
    <div class="palette-divider"></div>
    <div class="palette-custom-input-row">
      <span class="custom-input-label">Tùy chỉnh:</span>
      <input type="number" class="custom-number-input radius-custom-input" min="0" max="200" step="1" value="${currentRadius >= 100 ? 50 : currentRadius}" placeholder="vd: 12" />
      <span class="custom-input-unit">px</span>
      <button class="custom-input-apply btn-pill btn-dark">Lưu</button>
    </div>
  `;

  positionPopover(popover, anchorEl, 220);

  popover.querySelectorAll('.radius-preset-row').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const rad = parseInt(btn.getAttribute('data-radius'), 10);
      popover.remove();
      onSelect(rad);
    };
  });

  // Custom radius input handlers
  const customInp = popover.querySelector('.radius-custom-input');
  const customApply = popover.querySelector('.custom-input-apply');
  if (customInp) {
    customInp.onpointerdown = (e) => e.stopPropagation();
    customInp.onmousedown = (e) => e.stopPropagation();
    customInp.onclick = (e) => e.stopPropagation();
    customInp.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') applyCustomRadius();
    };
    customInp.oninput = (e) => {
      e.stopPropagation();
      const val = parseInt(customInp.value, 10);
      if (!isNaN(val) && val >= 0) {
        onSelect(val);
      }
    };
    const applyCustomRadius = () => {
      const val = parseInt(customInp.value, 10);
      if (!isNaN(val) && val >= 0) {
        onSelect(val);
        popover.remove();
      }
    };
    if (customApply) {
      customApply.onclick = (e) => {
        e.stopPropagation();
        applyCustomRadius();
      };
    }
  }

  attachSafeOutsideClick(popover, anchorEl);
  document.body.appendChild(popover);
}

/**
 * Line / Border Stroke Popover (Đường viền & Nét)
 * Enhanced with custom numeric input & safe event containment
 */
export function showLineWidthPopover({
  anchorEl,
  currentColor = '#111111',
  currentWidth = 2,
  onSelectWidth = () => {},
  onSelectColor = () => {}
}) {
  const existing = document.getElementById('lineWidthPopover');
  closeAllPopovers();
  if (existing) return;

  const popover = document.createElement('div');
  popover.id = 'lineWidthPopover';
  popover.className = 'color-stroke-popover line-width-popover';

  const normCurrent = (currentColor || '#111111').toLowerCase();

  const weights = [
    { value: 0, label: '0px (Ẩn)' },
    { value: 1, label: '1px' },
    { value: 1.5, label: '1.5px' },
    { value: 2, label: '2px' },
    { value: 3, label: '3px' },
    { value: 5, label: '5px' },
    { value: 8, label: '8px' }
  ];

  const weightsHtml = weights.map(w => {
    const isSelected = currentWidth === w.value;
    return `
      <button class="stroke-preset-btn ${isSelected ? 'active' : ''}" data-weight="${w.value}">
        <div class="stroke-preview-bar" style="height: ${Math.max(1, w.value)}px; background-color: ${normCurrent};"></div>
        <span class="stroke-preset-label">${w.label}</span>
      </button>
    `;
  }).join('');

  const swatchesHtml = PALETTE_COLORS.map(c => {
    const isSelected = normCurrent === c.toLowerCase();
    const light = isLightColor(c);
    const checkColor = light ? '#111827' : '#ffffff';
    return `
      <button class="palette-swatch-btn ${isSelected ? 'active' : ''}" data-color="${c}" style="background-color: ${c};" title="${c}">
        ${isSelected ? `<span class="swatch-check-mark" style="color: ${checkColor};">✓</span>` : ''}
      </button>
    `;
  }).join('');

  popover.innerHTML = `
    <div class="palette-popover-header">
      <span class="palette-popover-title">Độ Dày Nét Viền (Line Weight)</span>
    </div>
    <div class="palette-stroke-grid">
      ${weightsHtml}
    </div>
    <div class="palette-divider"></div>
    <div class="palette-custom-input-row">
      <span class="custom-input-label">Tùy chỉnh:</span>
      <input type="number" class="custom-number-input stroke-custom-input" min="0" max="50" step="0.5" value="${currentWidth}" placeholder="vd: 2.5" />
      <span class="custom-input-unit">px</span>
      <button class="custom-input-apply btn-pill btn-dark">Lưu</button>
    </div>
    <div class="palette-divider"></div>
    <div class="palette-section-sub">
      <span class="palette-sub-title">Màu đường viền (Line Color)</span>
    </div>
    <div class="palette-swatches-grid">
      ${swatchesHtml}
    </div>
  `;

  positionPopover(popover, anchorEl, 240);

  // Preset stroke click handlers
  popover.querySelectorAll('.stroke-preset-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const w = parseFloat(btn.getAttribute('data-weight'));
      popover.querySelectorAll('.stroke-preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const customInp = popover.querySelector('.stroke-custom-input');
      if (customInp) customInp.value = w;
      onSelectWidth(w);
    };
  });

  // Custom stroke number input handlers
  const customInp = popover.querySelector('.stroke-custom-input');
  const customApply = popover.querySelector('.custom-input-apply');
  if (customInp) {
    customInp.onpointerdown = (e) => e.stopPropagation();
    customInp.onmousedown = (e) => e.stopPropagation();
    customInp.onclick = (e) => e.stopPropagation();
    customInp.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') applyCustomWidth();
    };
    customInp.oninput = (e) => {
      e.stopPropagation();
      const val = parseFloat(customInp.value);
      if (!isNaN(val) && val >= 0) {
        onSelectWidth(val);
      }
    };
    const applyCustomWidth = () => {
      const val = parseFloat(customInp.value);
      if (!isNaN(val) && val >= 0) {
        onSelectWidth(val);
        popover.remove();
      }
    };
    if (customApply) {
      customApply.onclick = (e) => {
        e.stopPropagation();
        applyCustomWidth();
      };
    }
  }

  // Palette swatch click handlers
  popover.querySelectorAll('.palette-swatch-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const color = btn.getAttribute('data-color');
      popover.querySelectorAll('.palette-swatch-btn').forEach(b => {
        b.classList.remove('active');
        b.innerHTML = '';
      });
      btn.classList.add('active');
      const light = isLightColor(color);
      btn.innerHTML = `<span class="swatch-check-mark" style="color: ${light ? '#111827' : '#ffffff'};">✓</span>`;
      popover.querySelectorAll('.stroke-preview-bar').forEach(bar => {
        bar.style.backgroundColor = color;
      });
      onSelectColor(color);
    };
  });

  attachSafeOutsideClick(popover, anchorEl);
  document.body.appendChild(popover);
}

/**
 * Cloud Arc Scallop Radius Popover (Vòm mây kiến trúc)
 * Enhanced with custom numeric input & safe event containment
 */
export function showCloudArcPopover({ anchorEl, currentArcRadius = 14, onSelect = () => {} }) {
  const existing = document.getElementById('cloudArcPopover');
  closeAllPopovers();
  if (existing) return;

  const popover = document.createElement('div');
  popover.id = 'cloudArcPopover';
  popover.className = 'radius-popover cloud-arc-popover';

  const presets = [
    { value: 10, label: '10px', name: 'Vòm nhỏ (Đám mây mịn)' },
    { value: 14, label: '14px', name: 'Vòm vừa (Chuẩn CAD kiến trúc)' },
    { value: 20, label: '20px', name: 'Vòm lớn (Bản vẽ khổ lớn)' },
    { value: 28, label: '28px', name: 'Vòm rộng (Tổng thể mặt bằng)' }
  ];

  const itemsHtml = presets.map(p => {
    const isSelected = currentArcRadius === p.value;
    return `
      <button class="radius-preset-row ${isSelected ? 'active' : ''}" data-arc="${p.value}">
        <span class="cloud-arc-bullet">☁</span>
        <div class="radius-preset-info">
          <span class="radius-preset-val">${p.label}</span>
          <span class="radius-preset-name">${p.name}</span>
        </div>
        ${isSelected ? '<span class="radius-check">✓</span>' : ''}
      </button>
    `;
  }).join('');

  popover.innerHTML = `
    <div class="palette-popover-header">
      <span class="palette-popover-title">Độ Cong Vòm Mây (Arc Radius)</span>
    </div>
    <div class="radius-presets-list">
      ${itemsHtml}
    </div>
    <div class="palette-divider"></div>
    <div class="palette-custom-input-row">
      <span class="custom-input-label">Tùy chỉnh:</span>
      <input type="number" class="custom-number-input arc-custom-input" min="4" max="100" step="1" value="${currentArcRadius}" placeholder="vd: 16" />
      <span class="custom-input-unit">px</span>
      <button class="custom-input-apply btn-pill btn-dark">Lưu</button>
    </div>
  `;

  positionPopover(popover, anchorEl, 220);

  // Preset click handlers
  popover.querySelectorAll('.radius-preset-row').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const arc = parseInt(btn.getAttribute('data-arc'), 10);
      popover.remove();
      onSelect(arc);
    };
  });

  // Custom cloud arc input handlers
  const customInp = popover.querySelector('.arc-custom-input');
  const customApply = popover.querySelector('.custom-input-apply');
  if (customInp) {
    customInp.onpointerdown = (e) => e.stopPropagation();
    customInp.onmousedown = (e) => e.stopPropagation();
    customInp.onclick = (e) => e.stopPropagation();
    customInp.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') applyCustomArc();
    };
    customInp.oninput = (e) => {
      e.stopPropagation();
      const val = parseInt(customInp.value, 10);
      if (!isNaN(val) && val >= 4) {
        onSelect(val);
      }
    };
    const applyCustomArc = () => {
      const val = parseInt(customInp.value, 10);
      if (!isNaN(val) && val >= 4) {
        onSelect(val);
        popover.remove();
      }
    };
    if (customApply) {
      customApply.onclick = (e) => {
        e.stopPropagation();
        applyCustomArc();
      };
    }
  }

  attachSafeOutsideClick(popover, anchorEl);
  document.body.appendChild(popover);
}

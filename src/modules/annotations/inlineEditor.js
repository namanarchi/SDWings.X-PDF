/**
 * inlineEditor.js
 * In-place text editor mounted directly over the canvas without popup modals.
 */

import { syncPropertyToolbarValues, updatePropertyToolbarPosition } from './propertyToolbar.js';

export function startDirectInlineEdit(manager, pageIndex, overlayCanvas, annot) {
  const container = overlayCanvas.parentElement;
  if (!container || !annot) return;

  const existing = container.querySelector('.direct-inline-input');
  if (existing) existing.remove();

  const w = overlayCanvas.width;
  const h = overlayCanvas.height;
  const isComment = annot.type === 'comment';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = `direct-inline-input ${isComment ? 'direct-comment-input' : 'direct-text-input'}`;
  
  if (isComment) {
    const cx = annot.x * w;
    const cy = annot.y * h;
    const cw = (annot.w !== undefined ? annot.w * w : 120);
    const ch = (annot.h !== undefined ? annot.h * h : 28);
    const fs = Math.max(11, Math.round((annot.fontSize || 13) * (w / 1000)));

    input.style.left = `${cx + 6}px`;
    input.style.top = `${cy + Math.max(2, (ch - (fs * 1.5)) / 2)}px`;
    input.style.width = `${Math.max(100, cw - 12)}px`;
    input.style.height = `${Math.max(20, fs * 1.4)}px`;
    input.style.fontSize = `${fs}px`;
    input.style.fontFamily = annot.fontFamily || 'sans-serif';
    input.style.fontWeight = '600';
    input.style.color = annot.textColor || annot.color || '#92400e';
    input.value = annot.text ? annot.text.replace(/^💬\s*/, '') : '';
    input.placeholder = 'Nhập ghi chú...';
  } else {
    const tx = annot.x * w;
    const ty = annot.y * h;
    const fs = Math.max(12, Math.round((annot.fontSize || 14) * (w / 1000)));

    input.style.left = `${tx}px`;
    input.style.top = `${ty}px`;
    input.style.minWidth = '100px';
    input.style.maxWidth = `${Math.max(120, w - tx - 20)}px`;
    input.style.fontSize = `${fs}px`;
    input.style.fontFamily = annot.fontFamily || 'sans-serif';
    input.style.fontWeight = annot.bold ? '600' : '400';
    input.style.color = annot.color || '#111827';
    if (annot.bgColor && annot.bgColor !== 'transparent') {
      input.style.backgroundColor = annot.bgColor;
    }
    input.value = annot.text || '';
    input.placeholder = 'Nhập văn bản...';
  }

  annot._isEditing = true;
  const oldText = annot.text;
  const oldW = annot.w;
  manager.drawPageOverlay(pageIndex, overlayCanvas);

  const commit = () => {
    if (!input.parentElement) return;
    const val = input.value.trim();
    if (isComment) {
      annot.text = val ? `💬 ${val}` : '💬 Ghi chú';
      const fs = Math.max(11, Math.round((annot.fontSize || 13) * (w / 1000)));
      const ctx = overlayCanvas.getContext('2d');
      ctx.font = `600 ${fs}px ${annot.fontFamily || 'sans-serif'}`;
      const measured = ctx.measureText(annot.text).width + 24;
      if (measured > (annot.w || 0.16) * w) {
        annot.w = measured / w;
      }
    } else {
      annot.text = val || 'Văn bản';
    }
    delete annot._isEditing;
    input.remove();

    if (annot.text !== oldText || annot.w !== oldW) {
      manager.recordModify(pageIndex, annot, { text: oldText, w: oldW }, { text: annot.text, w: annot.w });
    }

    manager.drawPageOverlay(pageIndex, overlayCanvas);
    syncPropertyToolbarValues(manager);
    updatePropertyToolbarPosition(manager, overlayCanvas);
    manager.onStateChange({ dirty: true });
  };

  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      delete annot._isEditing;
      input.remove();
      manager.drawPageOverlay(pageIndex, overlayCanvas);
      syncPropertyToolbarValues(manager);
      updatePropertyToolbarPosition(manager, overlayCanvas);
    }
  };

  input.onblur = () => {
    commit();
  };

  container.appendChild(input);
  setTimeout(() => {
    input.focus();
    input.select();
  }, 20);
}

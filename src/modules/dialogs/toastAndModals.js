/**
 * toastAndModals.js
 * Toast notifications, custom confirmation modals, and prompt input dialogs.
 */

import { getIconHtml } from '../iconHelper.js';

/**
 * Toast Notification Manager
 * Displays sleek floating toast alerts (info, success, warning, error)
 */
export function showToast(message, type = 'info', duration = 3200) {
  let toastContainer = document.getElementById('sdToastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'sdToastContainer';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;

  let iconName = 'Info';
  if (type === 'success') iconName = 'CheckCircle2';
  else if (type === 'warning') iconName = 'AlertTriangle';
  else if (type === 'error') iconName = 'AlertCircle';

  toast.innerHTML = `
    <span class="toast-icon">${getIconHtml(iconName, { size: 16 })}</span>
    <span class="toast-msg">${message}</span>
    <button class="toast-close-btn" title="Đóng">${getIconHtml('X', { size: 12 })}</button>
  `;

  toast.querySelector('.toast-close-btn').onclick = () => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 250);
  };

  toastContainer.appendChild(toast);

  // Auto remove
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 250);
    }
  }, duration);
}

/**
 * Custom Confirmation Modal (Architectural Paper Style)
 * Replaces window.confirm
 */
export function showConfirmModal({
  title = 'Xác Nhận Hành Động',
  message = '',
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
  isDanger = false,
  onConfirm = () => {},
  onCancel = () => {}
}) {
  const existing = document.getElementById('sdConfirmModal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'sdConfirmModal';
  overlay.className = 'custom-modal-overlay';

  overlay.innerHTML = `
    <div class="custom-modal-box">
      <div class="modal-brand-tag">
        <span class="brand-main">SDWings</span><span class="brand-blue-dot">.</span><span class="brand-main">PDFReader</span> <span class="brand-by">by</span> <span class="brand-sub-brand"><span class="brand-sub-name">SDWings</span><span class="brand-blue-dot">.</span><span class="brand-sub-x">X</span><sup class="brand-sub-reg">®</sup></span> · SYSTEM DIALOG
      </div>
      <h3 class="custom-modal-title">${title}</h3>
      <p class="custom-modal-desc">${message}</p>
      <div class="custom-modal-actions">
        <button class="btn-pill btn-light modal-cancel-btn">${cancelText}</button>
        <button class="btn-pill ${isDanger ? 'btn-danger-pill' : 'btn-dark'} modal-confirm-btn">
          ${confirmText}
        </button>
      </div>
    </div>
  `;

  const close = () => overlay.remove();

  overlay.querySelector('.modal-cancel-btn').onclick = () => {
    close();
    onCancel();
  };

  overlay.querySelector('.modal-confirm-btn').onclick = () => {
    close();
    onConfirm();
  };

  overlay.onclick = (e) => {
    if (e.target === overlay) {
      close();
      onCancel();
    }
  };

  document.body.appendChild(overlay);
}

/**
 * Custom Prompt Modal (Architectural Paper Style)
 * Replaces window.prompt for modal inputs
 */
export function showPromptModal({
  title = 'Nhập Thông Tin',
  message = '',
  defaultValue = '',
  placeholder = '',
  confirmText = 'Đồng ý',
  cancelText = 'Hủy',
  onConfirm = () => {}
}) {
  const existing = document.getElementById('sdPromptModal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'sdPromptModal';
  overlay.className = 'custom-modal-overlay';

  overlay.innerHTML = `
    <div class="custom-modal-box">
      <div class="modal-brand-tag">
        <span class="brand-main">SDWings</span><span class="brand-blue-dot">.</span><span class="brand-main">PDFReader</span> <span class="brand-by">by</span> <span class="brand-sub-brand"><span class="brand-sub-name">SDWings</span><span class="brand-blue-dot">.</span><span class="brand-sub-x">X</span><sup class="brand-sub-reg">®</sup></span> · INPUT
      </div>
      <h3 class="custom-modal-title">${title}</h3>
      ${message ? `<p class="custom-modal-desc">${message}</p>` : ''}
      <div class="custom-modal-input-row">
        <input type="text" class="custom-modal-input" value="${defaultValue}" placeholder="${placeholder}" autofocus />
      </div>
      <div class="custom-modal-actions">
        <button class="btn-pill btn-light prompt-cancel-btn">${cancelText}</button>
        <button class="btn-pill btn-dark prompt-confirm-btn">${confirmText}</button>
      </div>
    </div>
  `;

  const input = overlay.querySelector('.custom-modal-input');
  const close = () => overlay.remove();

  const commit = () => {
    const val = input.value.trim();
    close();
    onConfirm(val);
  };

  overlay.querySelector('.prompt-cancel-btn').onclick = close;
  overlay.querySelector('.prompt-confirm-btn').onclick = commit;

  input.onkeydown = (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') close();
  };

  overlay.onclick = (e) => {
    if (e.target === overlay) close();
  };

  document.body.appendChild(overlay);
  setTimeout(() => input.focus(), 50);
}

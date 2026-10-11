/**
 * popoverBase.js
 * Core popover positioning and teardown lifecycle management.
 */

/**
 * Closes all popovers and floating context menus across the application
 */
export function closeAllPopovers() {
  const popoverIds = [
    'fillColorPopover',
    'lineWidthPopover',
    'borderRadiusPopover',
    'fontPickerPopover',
    'scalePickerPopover',
    'stampPickerPopover',
    'colorStrokePopover',
    'cloudArcPopover'
  ];
  popoverIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
  document.querySelectorAll('.view-mode-popup').forEach(el => el.remove());
  const viewPopup = document.getElementById('viewModePopup');
  if (viewPopup) viewPopup.style.display = 'none';
  const viewTrigger = document.getElementById('stripViewTrigger');
  if (viewTrigger) viewTrigger.classList.remove('active');
}

/**
 * Positions a popover strictly above or below anchorEl with margin, avoiding covering anchor buttons
 */
export function positionPopover(popover, anchorEl, preferredWidth = 240) {
  const rect = anchorEl.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;

  if (spaceBelow < 280 && spaceAbove > spaceBelow) {
    // Open strictly above anchor button with margin (so button remains completely visible)
    popover.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    popover.style.top = 'auto';
  } else {
    // Open strictly below anchor button with margin (so button remains completely visible)
    popover.style.top = `${rect.bottom + 8}px`;
    popover.style.bottom = 'auto';
  }

  const maxLeft = window.innerWidth - preferredWidth - 12;
  const leftPos = Math.max(10, Math.min(maxLeft, rect.left));
  popover.style.left = `${leftPos}px`;
}

/**
 * Safely attaches outside-click dismissal to a popover while guarding inputs,
 * text typing, and preventing premature dismissal during data entry.
 */
export function attachSafeOutsideClick(popover, anchorEl) {
  popover.onpointerdown = (e) => e.stopPropagation();
  popover.onmousedown = (e) => e.stopPropagation();
  popover.onclick = (e) => e.stopPropagation();

  const handleOutside = (e) => {
    if (!popover || !popover.parentElement) {
      cleanup();
      return;
    }
    // If target is inside popover or anchorEl, do not close
    if (popover.contains(e.target) || (anchorEl && anchorEl.contains(e.target))) {
      return;
    }
    // If target is inside any related toolbar or popover or active input, do not close
    if (e.target && e.target.closest && (
      e.target.closest('.color-stroke-popover') ||
      e.target.closest('.fill-color-popover') ||
      e.target.closest('.radius-popover') ||
      e.target.closest('.scale-popover') ||
      e.target.closest('.stamp-popover') ||
      e.target.closest('.font-picker-popover') ||
      e.target.closest('.annot-property-toolbar') ||
      e.target.tagName === 'INPUT'
    )) {
      return;
    }
    cleanup();
    popover.remove();
  };

  const cleanup = () => {
    document.removeEventListener('click', handleOutside, true);
    document.removeEventListener('pointerdown', handleOutside, true);
  };

  setTimeout(() => {
    document.addEventListener('click', handleOutside, true);
    document.addEventListener('pointerdown', handleOutside, true);
  }, 30);
}

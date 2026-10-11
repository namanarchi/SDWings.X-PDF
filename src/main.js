import './style.css';
import { PdfEngine } from './modules/pdfEngine.js';
import { CombineManager } from './modules/combineManager.js';
import { OrganizeGrid } from './modules/organizeGrid.js';
import { SplitManager } from './modules/splitManager.js';
import { AnnotationManager } from './modules/annotationCanvas.js';
import { SignatureModal } from './modules/signatureModal.js';
import { createSampleArchitecturalPdf } from './modules/sampleDoc.js';
import { embedAnnotationsInPdf } from './modules/pdfOperations.js';
import { applyLucideIcons, getIconHtml } from './modules/iconHelper.js';
import { showToast, showConfirmModal, showPromptModal, showStampPickerPopover, showScalePickerPopover, showColorAndStrokePopover, closeAllPopovers } from './modules/dialogManager.js';
import { ContextMenuManager } from './modules/contextMenu.js';
import { TabManager } from './modules/tabManager.js';

// Application State
const state = {
  currentMode: 'read', // 'read' | 'combine' | 'split' | 'organize' | 'annotate'
  docBuffer: null,
  docName: 'BD01 · Conference Hall.pdf',
  numPages: 3,
  currentPage: 1,
  currentZoom: 1.0,
  viewMode: 'continuous',
  isDraggingFile: false
};

// Module Instances
let pdfEngine;
let combineManager;
let organizeGrid;
let splitManager;
let annotationManager;
let signatureModal;
let tabManager;

// DOM Elements
const readerContainer = document.getElementById('readerContainer');
const combineContainer = document.getElementById('combineContainer');
const splitContainer = document.getElementById('splitContainer');
const organizeContainer = document.getElementById('organizeContainer');

const rightStatusBadge = document.getElementById('rightStatusBadge');
const documentTitle = document.getElementById('documentTitle');
const universalDragOverlay = document.getElementById('universalDragOverlay');

async function initApp() {
  // 0. Render static icons in DOM immediately
  applyLucideIcons(document);
  // 1. Initialize Annotation Manager
  annotationManager = new AnnotationManager();
  annotationManager.onStateChange = (ev) => {
    updateStatusIndicators();
    refreshAnnotationOverlays();
    updateUndoRedoButtons();
    if (ev && ev.tool) {
      syncFloatingAnnotTool(ev.tool);
      updateCursorMode();
    }
  };

  // 2. Initialize Signature Modal
  signatureModal = new SignatureModal({
    onSave: (dataUrl) => {
      annotationManager.setSignatureData(dataUrl);
      refreshAnnotationOverlays();
      updateStatusIndicators();
    }
  });
  annotationManager.onRequestSignature = () => {
    signatureModal.show();
  };

  // 3. Initialize PDF Engine
  pdfEngine = new PdfEngine({
    container: readerContainer,
    onPageChange: (cur, total) => {
      state.currentPage = cur;
      state.numPages = total;
      updateStatusBadges();
      updateStatusIndicators();
    },
    onDocLoaded: ({ numPages, docName }) => {
      state.numPages = numPages;
      state.docName = docName;
      documentTitle.textContent = docName.replace(/\.pdf$/i, '');
      if (tabManager) {
        tabManager.updateActiveTab({ numPages, name: docName });
        tabManager.renderTabs();
      }
      updateStatusBadges();
      updateStatusIndicators();
    },
    onZoomChange: (scale) => {
      state.currentZoom = scale;
      updateStatusBadges();
      updateStatusIndicators();
    }
  });

  // Bind annotation overlay whenever a page canvas is rendered and redraw existing annotations
  pdfEngine.onPageRendered = (pageNo, viewport, overlayCanvas) => {
    annotationManager.bindOverlay(pageNo - 1, overlayCanvas);
    annotationManager.drawPageOverlay(pageNo - 1, overlayCanvas);
  };

  // 4. Initialize Combine Manager
  combineManager = new CombineManager({
    container: combineContainer,
    onCombineComplete: async (mergedBytes, newName) => {
      switchMode('read');
      await tabManager.addTab({
        name: newName,
        buffer: mergedBytes.buffer,
        numPages: 1,
        makeActive: true
      });
      showToast(`Đã tạo tệp gộp mới: ${newName}`, 'success');
    },
    onCombineExport: (mergedBytes, newName) => {
      downloadBlob(new Blob([mergedBytes], { type: 'application/pdf' }), newName);
    },
    onClose: () => switchMode('read')
  });

  // 5. Initialize Organize Grid
  organizeGrid = new OrganizeGrid({
    container: organizeContainer,
    onApplyChanges: async (updatedBytes) => {
      const curTab = tabManager ? tabManager.getActiveTab() : null;
      if (curTab) {
        curTab.buffer = updatedBytes.buffer;
        curTab.annotationsByPage = new Map();
        curTab.history = [];
        curTab.redoStack = [];
      }
      state.docBuffer = updatedBytes.buffer;
      annotationManager.clearAllAnnotations();
      switchMode('read');
      await pdfEngine.loadFromBuffer(state.docBuffer, state.docName);
    },
    onClose: () => switchMode('read')
  });

  // 6. Initialize Split Manager
  splitManager = new SplitManager({
    container: splitContainer,
    onClose: () => switchMode('read')
  });

  // 7. Initialize Multi-Document Tab Manager (CAD Precision & Drag-and-Drop)
  tabManager = new TabManager({
    container: document.getElementById('documentTabsBar'),
    onSaveState: (tab) => {
      tab.numPages = state.numPages;
      tab.currentPage = state.currentPage;
      tab.zoomScale = state.currentZoom;
      tab.layoutCols = pdfEngine.layoutCols;
      tab.rotation = pdfEngine.rotation;
      tab.annotationsByPage = new Map(annotationManager.annotationsByPage);
      tab.history = [...annotationManager.history];
      tab.redoStack = [...annotationManager.redoStack];
      tab.scaleRatio = annotationManager.scaleRatio;
      tab.unit = annotationManager.unit;
    },
    onTabChange: async (tab) => {
      state.docBuffer = tab.buffer;
      state.docName = tab.name;
      state.currentPage = tab.currentPage || 1;
      state.numPages = tab.numPages || 1;
      documentTitle.textContent = tab.name.replace(/\.pdf$/i, '');

      // Restore annotation states
      annotationManager.annotationsByPage = new Map(tab.annotationsByPage || []);
      annotationManager.history = [...(tab.history || [])];
      annotationManager.redoStack = [...(tab.redoStack || [])];
      if (tab.scaleRatio) annotationManager.scaleRatio = tab.scaleRatio;
      if (tab.unit) annotationManager.unit = tab.unit;

      // Always reset tool to 'select' when switching files so text selection works immediately
      annotationManager.setTool('select');
      syncFloatingAnnotTool('select');

      if (state.currentMode !== 'read' && state.currentMode !== 'annotate') {
        switchMode('read');
      }

      await pdfEngine.loadFromBuffer(tab.buffer, tab.name);

      if (tab.layoutCols && tab.layoutCols !== pdfEngine.layoutCols) {
        pdfEngine.setLayoutCols(tab.layoutCols);
      }
      if (tab.currentPage && tab.currentPage > 1) {
        pdfEngine.goToPage(tab.currentPage);
      }
      updateUndoRedoButtons();
      updatePopupChecks();
      updateStatusBadges();
      updateStatusIndicators();
    },
    onAllTabsClosed: async () => {
      showToast('Tất cả tài liệu đã đóng. Đang nạp bản vẽ kiến trúc mẫu...', 'info');
      const samplePdfBytes = await createSampleArchitecturalPdf();
      await tabManager.addTab({
        name: 'BD01 · Conference Hall Plan.pdf',
        buffer: samplePdfBytes.buffer,
        numPages: 3,
        isSample: true,
        makeActive: true
      });
    },
    onOpenFiles: () => {
      document.getElementById('globalFileInput').click();
    }
  });

  // 8. Setup Primary Mode Buttons & Top Actions
  setupPrimaryToolbar();
  setupFloatingToolbars();
  setupUniversalDragAndDrop();
  setupKeyboardShortcuts();

  // 9. Load Initial Sample Architectural Blueprint into Tabs
  const samplePdfBytes = await createSampleArchitecturalPdf();
  await tabManager.addTab({
    name: 'BD01 · Conference Hall Plan.pdf',
    buffer: samplePdfBytes.buffer,
    numPages: 3,
    isSample: true,
    makeActive: true
  });
  updateUndoRedoButtons();

  // Apply Lucide icons to all statically declared elements
  applyLucideIcons(document);
}

/**
 * Primary Toolbar Switching
 */
function setupPrimaryToolbar() {
  document.querySelectorAll('#primaryModesGroup button').forEach(btn => {
    btn.onclick = () => {
      const mode = btn.getAttribute('data-mode');
      if (mode) {
        if (state.currentMode === mode) {
          switchMode('read');
        } else {
          switchMode(mode);
        }
      }
    };
  });

  // Brand Name / Logo Click: Return to open PDF pages from Combine, Split, Organize modes
  const brandLogoBtn = document.getElementById('brandLogoBtn') || document.querySelector('.brand-logo-container');
  if (brandLogoBtn) {
    brandLogoBtn.onclick = () => {
      if (state.currentMode !== 'read') {
        switchMode('read');
        showToast('Đã quay lại các trang PDF đang mở', 'info');
      }
    };
  }

  // Global File Input (Multiple PDF selection supported)
  const globalInput = document.getElementById('globalFileInput');
  globalInput.onchange = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      if (state.currentMode === 'combine') {
        combineManager.addFiles(files);
      } else {
        showToast(`Đang mở ${files.length} tệp tài liệu...`, 'info');
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const buffer = await file.arrayBuffer();
          await tabManager.addTab({
            name: file.name,
            buffer: buffer,
            numPages: 1,
            makeActive: i === 0
          });
        }
        showToast(`Đã mở ${files.length} tệp PDF trong các tab workbench`, 'success');
      }
      globalInput.value = '';
    }
  };

  // Native Desktop Host Bridge (Opens PDF files from CLI args, explorer association, or native drag-drop)
  window.addEventListener('message', async (event) => {
    if (event.data && event.data.type === 'open_external_pdf') {
      try {
        const { name, base64 } = event.data;
        const binaryStr = atob(base64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        await tabManager.addTab({
          name: name || 'Document.pdf',
          buffer: bytes.buffer,
          numPages: 1,
          makeActive: true
        });
        showToast(`Đã mở tệp: ${name}`, 'success');
      } catch (err) {
        console.error('Failed to open external pdf:', err);
      }
    }
  });

  // Save / Export PDF
  document.getElementById('btnExportPdf').onclick = async () => {
    if (!state.docBuffer) return;
    try {
      showToast('Đang kết xuất tài liệu PDF...', 'info');
      const finalBytes = await embedAnnotationsInPdf(state.docBuffer, annotationManager.annotationsByPage);
      downloadBlob(new Blob([finalBytes], { type: 'application/pdf' }), `SDWings_${state.docName}`);
      showToast('Xuất tệp PDF thành công!', 'success');
    } catch (err) {
      console.error('Export error:', err);
      showToast('Lỗi xuất file: ' + err.message, 'error');
    }
  };
}

/**
 * Switch Active Application Mode
 */
function switchMode(newMode) {
  closeAllPopovers();
  state.currentMode = newMode;

  // Update primary button states
  document.querySelectorAll('#primaryModesGroup button').forEach(btn => {
    if (btn.getAttribute('data-mode') === newMode) {
      btn.className = 'btn-pill btn-dark active';
    } else if (btn.getAttribute('data-mode')) {
      btn.className = 'btn-pill btn-light';
    }
  });

  // Toggle active view panel
  readerContainer.classList.remove('active-panel');
  combineContainer.classList.remove('active-panel');
  splitContainer.classList.remove('active-panel');
  organizeContainer.classList.remove('active-panel');

  const isReader = newMode === 'read' || newMode === 'annotate';
  const annotBar = document.getElementById('floatingAnnotBar');
  const navStrip = document.getElementById('floatingNavStrip');
  if (annotBar) annotBar.style.display = isReader ? 'flex' : 'none';
  if (navStrip) navStrip.style.display = isReader ? 'flex' : 'none';

  if (isReader) {
    readerContainer.classList.add('active-panel');
    updateCursorMode();
  } else if (newMode === 'combine') {
    combineContainer.classList.add('active-panel');
    combineManager.render();
  } else if (newMode === 'split') {
    splitContainer.classList.add('active-panel');
    splitManager.loadDocument(state.docBuffer, state.docName, state.numPages);
  } else if (newMode === 'organize') {
    organizeContainer.classList.add('active-panel');
    organizeGrid.loadDocument(state.docBuffer);
  }

  updateStatusIndicators();
  updateStatusBadges();
}

/**
 * Update Status Indicators
 */
function updateStatusIndicators() {
  if (!rightStatusBadge) return;
  if (state.currentMode === 'read') {
    rightStatusBadge.textContent = 'AUDITORIUM · VISIBLE';
  } else if (state.currentMode === 'annotate') {
    rightStatusBadge.textContent = 'CAD MARKUP · ACTIVE';
  } else if (state.currentMode === 'combine') {
    rightStatusBadge.textContent = `${combineManager.items.length} FILES · QUEUED`;
  } else if (state.currentMode === 'split') {
    rightStatusBadge.textContent = `${state.numPages} TRANG · SẴN SÀNG`;
  } else if (state.currentMode === 'organize') {
    rightStatusBadge.textContent = `${organizeGrid.pages.length} TRANG · GRID VIEW`;
  }
}

function syncFloatingAnnotTool(tool) {
  const bar = document.getElementById('floatingAnnotBar');
  if (!bar) return;
  bar.querySelectorAll('.annot-tool-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tool') === tool);
  });
}

function setupFloatingToolbars() {
  // 1. Floating Annotation Toolbar (Left Dock)
  const annotBar = document.getElementById('floatingAnnotBar');
  if (annotBar) {
    annotBar.querySelectorAll('.annot-tool-btn').forEach(btn => {
      btn.onclick = () => {
        const tool = btn.getAttribute('data-tool');
        if (!tool) return; // Special action buttons handled below

        if (state.currentMode !== 'annotate') {
          switchMode('annotate');
        }

        annotBar.querySelectorAll('.annot-tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (tool === 'comment') {
          annotationManager.setTool('comment');
          showToast('Chế độ Ghi chú: Nhấp vào vị trí bất kỳ trên bản vẽ để thêm ghi chú', 'info');
        } else if (tool === 'shape') {
          annotationManager.setTool('shape');
          showToast('Vẽ hình dạng bất kỳ: Nhấp các điểm, giữ Shift để vẽ thẳng, nhấp điểm đầu hoặc Enter để khép kín', 'info');
        } else if (tool === 'curve') {
          annotationManager.setTool('curve');
          showToast('Vẽ đường cong mềm (Curvature): Nhấp các điểm để uốn cong mượt mà, nhấp điểm đầu để khép kín hình', 'info');
        } else if (tool === 'pen') {
          annotationManager.setTool('pen');
          showToast('Bút vẽ tự do: Tự động bắt điểm, giữ Shift để vẽ đường thẳng', 'info');
        } else if (tool === 'signature') {
          signatureModal.show();
        } else if (tool === 'image') {
          const imgInput = document.getElementById('imageFileInput');
          if (imgInput) imgInput.click();
        } else if (tool === 'stamp') {
          showStampPickerPopover({
            anchorEl: btn,
            onSelect: (stampText, stampColor) => {
              annotationManager.setStamp(stampText, stampColor);
              showToast(`Đã chọn con dấu: ${stampText}`, 'success');
              updateCursorMode();
            }
          });
        } else {
          annotationManager.setTool(tool);
        }
        updateCursorMode();
      };
    });

    // Image Attachment File Input Handler
    const imageFileInput = document.getElementById('imageFileInput');
    if (imageFileInput) {
      imageFileInput.onchange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = () => {
            const curPage = Math.max(0, (state.currentPage || 1) - 1);
            annotationManager.addImageAnnotation(curPage, reader.result);
            showToast(`Đã đính kèm hình ảnh "${file.name}" vào bản vẽ`, 'success');
          };
          reader.readAsDataURL(file);
          imageFileInput.value = '';
        }
      };
    }

    // Color Swatch & Stroke Thickness Triggers (Matching User Image)
    const barColorTrigger = document.getElementById('barColorTrigger');
    const barStrokeTrigger = document.getElementById('barStrokeTrigger');
    const barColorPreview = document.getElementById('barColorPreview');

    const openColorPicker = (anchor) => {
      showColorAndStrokePopover({
        anchorEl: anchor,
        currentColor: annotationManager.strokeColor,
        currentStroke: annotationManager.strokeWidth,
        onSelectColor: (color) => {
          annotationManager.setColor(color);
          annotationManager.updateSelectedAnnotColor(color);
          if (barColorPreview) barColorPreview.style.backgroundColor = color;
          showToast(`Đã chọn màu: ${color}`, 'info');
          refreshAnnotationOverlays();
        },
        onSelectStroke: (weight) => {
          annotationManager.setStrokeWidth(weight);
          annotationManager.updateSelectedAnnotStroke(weight);
          showToast(`Đã đổi nét vẽ: ${weight}px`, 'info');
          refreshAnnotationOverlays();
        }
      });
    };

    if (barColorTrigger) {
      barColorTrigger.onclick = (e) => {
        openColorPicker(e.currentTarget);
      };
    }

    if (barStrokeTrigger) {
      barStrokeTrigger.onclick = (e) => {
        openColorPicker(e.currentTarget);
      };
    }

    // Special Annotation Toolbar Action Buttons
    const barScaleCad = document.getElementById('barScaleCad');
    if (barScaleCad) {
      barScaleCad.onclick = (e) => {
        showScalePickerPopover({
          anchorEl: e.currentTarget,
          currentRatio: annotationManager.scaleRatio,
          onSelect: (r) => {
            annotationManager.setScaleRatio(r, 'm');
            showToast(`Đã đổi tỷ lệ CAD thành 1:${r}`, 'success');
          }
        });
      };
    }

    const barUndo = document.getElementById('barUndo');
    if (barUndo) {
      barUndo.onclick = () => {
        annotationManager.undo();
        updateUndoRedoButtons();
      };
    }

    const barRedo = document.getElementById('barRedo');
    if (barRedo) {
      barRedo.onclick = () => {
        annotationManager.redo();
        updateUndoRedoButtons();
      };
    }

    const barClearAnnot = document.getElementById('barClearAnnot');
    if (barClearAnnot) {
      barClearAnnot.onclick = () => {
        showConfirmModal({
          title: 'Xóa Toàn Bộ Ghi Chú',
          message: 'Bạn có chắc chắn muốn xóa tất cả các ghi chú, nét vẽ và đo đạc kỹ thuật trên tài liệu này?',
          confirmText: 'Xóa toàn bộ',
          isDanger: true,
          onConfirm: () => {
            annotationManager.clearAllAnnotations();
            showToast('Đã xóa tất cả ghi chú trên tài liệu', 'info');
          }
        });
      };
    }
  }

  // 2. Floating Right Navigation Strip (Right Dock)
  const stripPrev = document.getElementById('stripPrevPage');
  if (stripPrev) stripPrev.onclick = () => pdfEngine.prevPage();

  const stripNext = document.getElementById('stripNextPage');
  if (stripNext) stripNext.onclick = () => pdfEngine.nextPage();

  const stripZoomIn = document.getElementById('stripZoomIn');
  if (stripZoomIn) stripZoomIn.onclick = () => pdfEngine.zoomIn();

  const stripZoomOut = document.getElementById('stripZoomOut');
  if (stripZoomOut) stripZoomOut.onclick = () => pdfEngine.zoomOut();

  const stripRotate = document.getElementById('stripRotate');
  if (stripRotate) stripRotate.onclick = () => pdfEngine.rotateDocument();

  // Floating In-Document Search Bar
  const stripSearch = document.getElementById('stripSearch');
  const searchBar = document.getElementById('pdfSearchBar');
  const searchInput = document.getElementById('pdfSearchInput');
  const searchCount = document.getElementById('pdfSearchCount');
  const btnSearchPrev = document.getElementById('btnSearchPrev');
  const btnSearchNext = document.getElementById('btnSearchNext');
  const btnSearchClose = document.getElementById('btnSearchClose');

  const openSearchBar = (initialQuery = '') => {
    if (!searchBar) return;
    searchBar.style.display = 'flex';
    stripSearch?.classList.add('active');
    setTimeout(() => {
      if (searchInput) {
        if (initialQuery) {
          searchInput.value = initialQuery;
          performSearch();
        }
        searchInput.focus();
        searchInput.select();
      }
    }, 50);
  };

  const closeSearchBar = () => {
    if (!searchBar) return;
    searchBar.style.display = 'none';
    stripSearch?.classList.remove('active');
    pdfEngine.clearSearchHighlights();
    if (searchCount) searchCount.textContent = '0 / 0';
  };

  if (stripSearch) {
    stripSearch.onclick = () => {
      if (searchBar.style.display === 'none') {
        openSearchBar();
      } else {
        closeSearchBar();
      }
    };
  }

  if (btnSearchClose) btnSearchClose.onclick = closeSearchBar;

  const performSearch = () => {
    const q = searchInput?.value || '';
    const res = pdfEngine.searchAndHighlight(q);
    if (searchCount) {
      searchCount.textContent = res.total > 0 ? `${res.current} / ${res.total}` : (q ? '0 kết quả' : '0 / 0');
    }
  };

  if (searchInput) {
    searchInput.oninput = () => performSearch();
    searchInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          const res = pdfEngine.prevSearchMatch();
          if (searchCount) searchCount.textContent = `${res.current} / ${res.total}`;
        } else {
          const res = pdfEngine.nextSearchMatch();
          if (searchCount) searchCount.textContent = `${res.current} / ${res.total}`;
        }
      } else if (e.key === 'Escape') {
        closeSearchBar();
      }
    };
  }

  if (btnSearchNext) {
    btnSearchNext.onclick = () => {
      const res = pdfEngine.nextSearchMatch();
      if (searchCount) searchCount.textContent = `${res.current} / ${res.total}`;
    };
  }

  if (btnSearchPrev) {
    btnSearchPrev.onclick = () => {
      const res = pdfEngine.prevSearchMatch();
      if (searchCount) searchCount.textContent = `${res.current} / ${res.total}`;
    };
  }

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      openSearchBar();
    }
  });

  // Click on Page Box to jump directly
  const stripPageBox = document.getElementById('stripPageBox');
  if (stripPageBox) {
    stripPageBox.onclick = () => {
      showPromptModal({
        title: 'Chuyển Đến Trang',
        message: `Nhập số trang cần xem (1 đến ${state.numPages}):`,
        defaultValue: String(state.currentPage),
        confirmText: 'Chuyển Trang',
        onConfirm: (val) => {
          const target = parseInt(val, 10);
          if (!isNaN(target) && target >= 1 && target <= state.numPages) {
            pdfEngine.goToPage(target);
          } else if (val) {
            showToast(`Số trang không hợp lệ (1 - ${state.numPages})`, 'warning');
          }
        }
      });
    };
  }

  // Dark / Light Theme Toggle
  const stripTheme = document.getElementById('stripThemeToggle');
  if (stripTheme) {
    stripTheme.onclick = () => {
      document.body.classList.toggle('dark-mode');
      const isDark = document.body.classList.contains('dark-mode');
      stripTheme.innerHTML = getIconHtml(isDark ? 'Sun' : 'Moon', { size: 18 });
      if (window.chrome && window.chrome.webview) {
        window.chrome.webview.postMessage({ type: 'theme_changed', isDark });
      }
    };
  }

  // View Mode Trigger (Book Icon):
  // Single click CYCLES 1 -> 2 -> 3 -> 4 -> 1 page layouts!
  // Right click / menu opens view mode popup
  const viewTrigger = document.getElementById('stripViewTrigger');
  const viewPopup = document.getElementById('viewModePopup');
  if (viewTrigger && viewPopup) {
    viewTrigger.onclick = (e) => {
      e.stopPropagation();
      closeAllPopovers();
      viewPopup.style.display = 'none';

      // Cycle page layout: 1 -> 2 -> 3 -> 4 -> 1
      const cols = pdfEngine.cyclePageLayout();
      const labels = {
        1: 'Sắp xếp 1 trang (Single)',
        2: 'Sắp xếp 2 trang (Song song)',
        3: 'Sắp xếp 3 trang (3 cột)',
        4: 'Sắp xếp 4 trang (Lưới 2x2)'
      };
      showToast(`${labels[cols] || cols + ' trang'}`, 'info');
      updatePopupChecks();
    };

    viewTrigger.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeAllPopovers();
      viewPopup.style.display = 'flex';
      viewTrigger.classList.add('active');
    };

    document.addEventListener('click', (e) => {
      if (!viewPopup.contains(e.target) && e.target !== viewTrigger && !viewTrigger.contains(e.target)) {
        viewPopup.style.display = 'none';
        viewTrigger.classList.remove('active');
      }
    });

    viewPopup.querySelectorAll('.popup-item').forEach(item => {
      item.onclick = (e) => {
        const action = item.getAttribute('data-action');
        viewPopup.style.display = 'none';
        viewTrigger.classList.remove('active');

        if (action === '1-page') {
          pdfEngine.setLayoutCols(1);
          showToast('Sắp xếp: 1 trang (Single)', 'info');
        } else if (action === '2-page') {
          pdfEngine.setLayoutCols(2);
          showToast('Sắp xếp: 2 trang (Song song)', 'info');
        } else if (action === '3-page') {
          pdfEngine.setLayoutCols(3);
          showToast('Sắp xếp: 3 trang (3 cột)', 'info');
        } else if (action === '4-page') {
          pdfEngine.setLayoutCols(4);
          showToast('Sắp xếp: 4 trang (Lưới 2x2)', 'info');
        } else if (action === 'fit-page') {
          pdfEngine.setZoom('fit-page');
        } else if (action === 'fit-width') {
          pdfEngine.setZoom('fit-width');
        } else if (action === 'fullscreen') {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
        }
        updatePopupChecks();
      };
    });
  }

  // 3. Right-Click Architectural Context Menu
  new ContextMenuManager({
    container: readerContainer,
    pdfEngine,
    annotationManager,
    onSearch: (text) => {
      openSearchBar(text);
    },
    onOpenSignature: () => {
      signatureModal.show();
    }
  });
}

function updatePopupChecks() {
  const check1 = document.getElementById('check1Page');
  const check2 = document.getElementById('check2Page');
  const check3 = document.getElementById('check3Page');
  const check4 = document.getElementById('check4Page');
  const checkIcon = getIconHtml('Check', { size: 14, color: '#2563eb' });

  if (check1) check1.innerHTML = pdfEngine.layoutCols === 1 ? checkIcon : '';
  if (check2) check2.innerHTML = pdfEngine.layoutCols === 2 ? checkIcon : '';
  if (check3) check3.innerHTML = pdfEngine.layoutCols === 3 ? checkIcon : '';
  if (check4) check4.innerHTML = pdfEngine.layoutCols === 4 ? checkIcon : '';
}

function updateCursorMode() {
  const isReader = state.currentMode === 'read' || state.currentMode === 'annotate';
  if (isReader) {
    readerContainer.className = `view-panel active-panel cursor-${annotationManager.currentTool}`;
  } else {
    readerContainer.className = `view-panel cursor-${annotationManager.currentTool}`;
  }
}

function refreshAnnotationOverlays() {
  document.querySelectorAll('.pdf-annotation-overlay').forEach(overlay => {
    const pageNo = parseInt(overlay.getAttribute('data-overlay-page'), 10);
    if (!isNaN(pageNo)) {
      annotationManager.drawPageOverlay(pageNo - 1, overlay);
    }
  });
}

function updateStatusBadges() {
  const stripPageCurrent = document.getElementById('stripPageCurrent');
  if (stripPageCurrent) stripPageCurrent.textContent = state.currentPage;
  const stripPageTotal = document.getElementById('stripPageTotal');
  if (stripPageTotal) stripPageTotal.textContent = state.numPages;
  const stripPageBox = document.getElementById('stripPageBox');
  if (stripPageBox && !stripPageCurrent) stripPageBox.textContent = state.currentPage;
}

function updateUndoRedoButtons() {
  const barUndo = document.getElementById('barUndo');
  const barRedo = document.getElementById('barRedo');
  if (barUndo) {
    const canUndo = annotationManager && annotationManager.history && annotationManager.history.length > 0;
    barUndo.classList.toggle('disabled', !canUndo);
    barUndo.title = canUndo ? `Hoàn tác (Undo · Ctrl+Z) [${annotationManager.history.length}]` : 'Hoàn tác (Undo · Ctrl+Z)';
  }
  if (barRedo) {
    const canRedo = annotationManager && annotationManager.redoStack && annotationManager.redoStack.length > 0;
    barRedo.classList.toggle('disabled', !canRedo);
    barRedo.title = canRedo ? `Làm lại (Redo · Ctrl+Y) [${annotationManager.redoStack.length}]` : 'Làm lại (Redo · Ctrl+Y)';
  }
}

/**
 * Universal Drag and Drop (from Windows Explorer / Desktop)
 */
function setupUniversalDragAndDrop() {
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
      state.isDraggingFile = true;
      universalDragOverlay.classList.add('visible');
    }
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  window.addEventListener('dragleave', (e) => {
    if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
      state.isDraggingFile = false;
      universalDragOverlay.classList.remove('visible');
    }
  });

  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    state.isDraggingFile = false;
    universalDragOverlay.classList.remove('visible');

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const allFiles = Array.from(e.dataTransfer.files);
      const imageFiles = allFiles.filter(f => f.type.startsWith('image/') || f.name.match(/\.(png|jpe?g|webp|svg|gif|bmp)$/i));
      const pdfFiles = allFiles.filter(f => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf');

      // 1. If images are dropped: insert them into the PDF page at drop point
      if (imageFiles.length > 0) {
        let pageIdx = Math.max(0, (state.currentPage || 1) - 1);
        let coords = null;
        const pageOverlay = document.elementsFromPoint(e.clientX, e.clientY).find(el => el.classList.contains('pdf-annotation-overlay'));
        if (pageOverlay) {
          const pNo = parseInt(pageOverlay.getAttribute('data-overlay-page'), 10);
          if (!isNaN(pNo)) pageIdx = pNo - 1;
          const rect = pageOverlay.getBoundingClientRect();
          coords = {
            x: (e.clientX - rect.left) / rect.width,
            y: (e.clientY - rect.top) / rect.height
          };
        }

        for (const imgFile of imageFiles) {
          const reader = new FileReader();
          reader.onload = () => {
            annotationManager.addImageAnnotation(pageIdx, reader.result, coords);
            showToast(`Đã đính kèm ảnh "${imgFile.name}" vào bản vẽ`, 'success');
          };
          reader.readAsDataURL(imgFile);
        }
        return;
      }

      // 2. If PDF files are dropped:
      if (pdfFiles.length === 0) {
        showToast('Chỉ hỗ trợ kéo thả tệp định dạng PDF hoặc Hình ảnh (PNG, JPG, WebP).', 'warning');
        return;
      }

      if (state.currentMode === 'combine') {
        // Multiple files dropped in combine mode -> enqueue
        await combineManager.addFiles(pdfFiles);
      } else {
        // Open all dropped files as separate tabs in the top tab bar
        showToast(`Đang nạp ${pdfFiles.length} tệp PDF vào các tab...`, 'info');
        for (let i = 0; i < pdfFiles.length; i++) {
          const file = pdfFiles[i];
          const buffer = await file.arrayBuffer();
          await tabManager.addTab({
            name: file.name,
            buffer: buffer,
            numPages: 1,
            makeActive: i === 0
          });
        }
        showToast(`Đã mở ${pdfFiles.length} tệp PDF trong các tab workbench`, 'success');
      }
    }
  });
}

/**
 * Keyboard Shortcuts & Clipboard Paste
 */
function setupKeyboardShortcuts() {
  // Paste image from clipboard (Ctrl+V)
  window.addEventListener('paste', (e) => {
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.isContentEditable) return;
    if (e.clipboardData && e.clipboardData.items) {
      for (const item of e.clipboardData.items) {
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = () => {
              const pageIdx = Math.max(0, (state.currentPage || 1) - 1);
              annotationManager.addImageAnnotation(pageIdx, reader.result);
              showToast('Đã dán hình ảnh từ clipboard vào bản vẽ', 'success');
            };
            reader.readAsDataURL(blob);
            break;
          }
        }
      }
    }
  });
  window.addEventListener('keydown', (e) => {
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.isContentEditable) {
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        document.getElementById('globalFileInput').click();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        document.getElementById('btnExportPdf').click();
      } else if (e.key === 'z' || e.key === 'Z') {
        if (!e.shiftKey) {
          e.preventDefault();
          annotationManager.undo();
        } else {
          e.preventDefault();
          annotationManager.redo();
        }
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        annotationManager.redo();
      }
    } else {
      if (e.key === '+' || e.key === '=') {
        pdfEngine.zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        pdfEngine.zoomOut();
      }
    }
  });

  // Alt + Scroll to zoom
  window.addEventListener('wheel', (e) => {
    if (e.altKey) {
      e.preventDefault();
      if (e.deltaY < 0) pdfEngine.zoomIn();
      else pdfEngine.zoomOut();
    }
  }, { passive: false });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Start application
window.addEventListener('DOMContentLoaded', initApp);

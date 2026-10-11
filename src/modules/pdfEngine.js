import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Configure Mozilla PDF.js worker using locally bundled asset
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export class PdfEngine {
  constructor(options = {}) {
    this.container = options.container;
    this.onPageChange = options.onPageChange || (() => {});
    this.onDocLoaded = options.onDocLoaded || (() => {});
    this.onZoomChange = options.onZoomChange || (() => {});
    this.onPageRendered = options.onPageRendered || null;
    
    this.pdfDoc = null;
    this.currentDocBuffer = null;
    this.docName = 'Chưa tải';
    this.numPages = 0;
    this.currentPage = 1;
    this.zoomScale = 1.0;
    this.viewMode = 'continuous'; // 'continuous' | 'single' | 'two-up'
    this.layoutCols = 1; // 1, 2, 3, 4 page layout arrangement
    this.rotation = 0; // 0, 90, 180, 270

    // Virtualization & Memory Management State
    this.renderTasks = new Map();
    this.pageCanvases = new Map();
    this.pageSizes = new Map();
    this.renderedPages = new Set();
    this.renderQueue = [];
    this.isProcessingQueue = false;
    this.viewportObserver = null;
    this.MAX_CONCURRENT_RENDERS = 2; // Keep worker responsive, zero freezing
    this.MAX_CACHED_PAGES = 8; // Max heavy canvases kept in VRAM for huge blueprints

    this.outlines = [];
    this.pageTextContent = new Map();

    // In-document text search state
    this.searchMatches = [];
    this.currentSearchMatchIndex = -1;
  }

  /**
   * Destroys current document instance, revokes GPU canvas backing stores,
   * cancels all ongoing worker tasks and frees memory.
   */
  async destroyCurrentDoc() {
    this.cancelAllRenders();
    this.renderQueue = [];

    if (this.viewportObserver) {
      this.viewportObserver.disconnect();
      this.viewportObserver = null;
    }

    // Explicitly release GPU texture memory for all canvases
    for (const [pageNo, info] of this.pageCanvases.entries()) {
      try {
        if (info.canvas) {
          info.canvas.width = 0;
          info.canvas.height = 0;
        }
        if (info.overlay) {
          info.overlay.width = 0;
          info.overlay.height = 0;
        }
        if (info.textLayerDiv) {
          info.textLayerDiv.innerHTML = '';
        }
      } catch (err) {
        console.warn('Canvas disposal warning on page', pageNo, err);
      }
    }

    this.pageCanvases.clear();
    this.renderedPages.clear();

    if (this.container) {
      this.container.innerHTML = '';
    }

    if (this.pdfDoc) {
      try {
        await this.pdfDoc.cleanup();
        await this.pdfDoc.destroy();
      } catch (e) {
        // Suppress if worker already terminating
      }
      this.pdfDoc = null;
    }

    this.currentDocBuffer = null;
    this.pageSizes.clear();
    this.pageTextContent.clear();
    this.outlines = [];
    this.searchMatches = [];
    this.currentSearchMatchIndex = -1;
  }

  /**
   * Loads a PDF document from an ArrayBuffer with memory leak safeguards
   */
  async loadFromBuffer(buffer, name = 'document.pdf') {
    // 1. Fully release previous document and all allocated GPU textures
    if (this.pdfDoc) {
      await this.destroyCurrentDoc();
    } else {
      this.cancelAllRenders();
    }

    this.currentDocBuffer = buffer;
    this.docName = name;

    // Use local offline CMap and standard fonts for zero latency & offline resilience
    const loadingTask = pdfjsLib.getDocument({
      data: buffer.slice(0),
      cMapUrl: './cmaps/',
      cMapPacked: true,
      standardFontDataUrl: './standard_fonts/'
    });

    this.pdfDoc = await loadingTask.promise;
    this.numPages = this.pdfDoc.numPages;
    this.currentPage = 1;
    this.rotation = 0;

    // Cache page dimensions and outlines without keeping full page glyphs in memory
    await this.cacheDocInfo();

    this.onDocLoaded({
      numPages: this.numPages,
      docName: this.docName,
      outlines: this.outlines
    });

    await this.render();
  }

  async cacheDocInfo() {
    this.pageSizes.clear();
    for (let i = 1; i <= this.numPages; i++) {
      const page = await this.pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      this.pageSizes.set(i, {
        width: viewport.width,
        height: viewport.height,
        rotate: page.rotate || 0
      });
      // Immediately free parsed page operators in worker
      if (typeof page.cleanup === 'function') {
        page.cleanup();
      }
    }

    try {
      this.outlines = (await this.pdfDoc.getOutline()) || [];
    } catch {
      this.outlines = [];
    }
  }

  cancelAllRenders() {
    for (const [pageNo, task] of this.renderTasks.entries()) {
      try {
        task.cancel();
      } catch {}
    }
    this.renderTasks.clear();
  }

  setZoom(scale) {
    if (scale === 'fit-width') {
      const firstSize = this.pageSizes.get(1) || { width: 800 };
      const containerWidth = this.container.clientWidth - 80;
      this.zoomScale = Math.max(0.25, Math.min(4.0, containerWidth / firstSize.width));
    } else if (scale === 'fit-page') {
      const firstSize = this.pageSizes.get(1) || { height: 1000 };
      const containerHeight = this.container.clientHeight - 80;
      this.zoomScale = Math.max(0.25, Math.min(4.0, containerHeight / firstSize.height));
    } else {
      this.zoomScale = Math.max(0.25, Math.min(5.0, Number(scale)));
    }

    this.onZoomChange(this.zoomScale);
    this.render();
  }

  zoomIn() {
    const next = Math.min(5.0, this.zoomScale * 1.2);
    this.setZoom(next);
  }

  zoomOut() {
    const next = Math.max(0.25, this.zoomScale / 1.2);
    this.setZoom(next);
  }

  setViewMode(mode) {
    this.viewMode = mode;
    this.render();
  }

  /**
   * Cycles page layout columns: 1 -> 2 -> 3 -> 4 -> 1
   */
  cyclePageLayout() {
    let nextCols = 1;
    if (this.layoutCols === 1) nextCols = 2;
    else if (this.layoutCols === 2) nextCols = 3;
    else if (this.layoutCols === 3) nextCols = 4;
    else nextCols = 1;

    this.setLayoutCols(nextCols);
    return nextCols;
  }

  setLayoutCols(cols) {
    this.layoutCols = cols;
    this.viewMode = 'continuous';

    if (this.pageSizes.size > 0 && this.container) {
      const firstSize = this.pageSizes.get(1) || { width: 800, height: 600 };
      const padding = 64;
      const gap = 20 * (cols - 1);
      const availableW = this.container.clientWidth - padding - gap;
      const targetColW = availableW / cols;
      const fittedScale = Math.max(0.25, Math.min(2.5, targetColW / firstSize.width));
      this.zoomScale = fittedScale;
      this.onZoomChange(this.zoomScale);
    }

    this.render();
  }

  rotateDocument() {
    this.rotation = (this.rotation + 90) % 360;
    this.render();
  }

  goToPage(pageNum) {
    if (pageNum < 1 || pageNum > this.numPages) return;
    this.currentPage = pageNum;
    this.onPageChange(this.currentPage, this.numPages);

    const pageEl = this.container.querySelector(`[data-page-num="${pageNum}"]`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Immediately prioritize rendering this target page
      this.queuePageRender(pageNum, true);
    }
  }

  nextPage() {
    if (this.currentPage < this.numPages) {
      this.goToPage(this.currentPage + 1);
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    }
  }

  /**
   * Master Virtualized Render Loop:
   * Sets up sized placeholder containers for all pages, only mounts high-res
   * canvases for visible & buffered pages to eliminate lag and out-of-memory crashes.
   */
  async render() {
    if (!this.pdfDoc || !this.container) return;
    this.cancelAllRenders();
    this.renderQueue = [];

    if (this.viewportObserver) {
      this.viewportObserver.disconnect();
      this.viewportObserver = null;
    }

    // Release old canvas textures
    for (const [pageNo, info] of this.pageCanvases.entries()) {
      if (info.canvas) {
        info.canvas.width = 0;
        info.canvas.height = 0;
      }
      if (info.overlay) {
        info.overlay.width = 0;
        info.overlay.height = 0;
      }
    }
    this.pageCanvases.clear();
    this.renderedPages.clear();

    this.container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = `pdf-canvas-wrapper view-cols-${this.layoutCols}`;
    this.container.appendChild(wrapper);

    // Build light placeholders with exact calculated dimensions
    for (let i = 1; i <= this.numPages; i++) {
      const pageContainer = this.createPageContainer(i);
      wrapper.appendChild(pageContainer);
    }

    // Set up viewport observer for virtual on-demand rendering
    this.setupVirtualizedObserver(wrapper);

    // Initial render of current page and adjacent neighbours
    const initialPages = [this.currentPage];
    if (this.currentPage > 1) initialPages.push(this.currentPage - 1);
    if (this.currentPage < this.numPages) initialPages.push(this.currentPage + 1);

    for (const p of initialPages) {
      this.queuePageRender(p, true);
    }
  }

  createPageContainer(pageNo) {
    const pageBox = document.createElement('div');
    pageBox.className = 'pdf-page-container';
    pageBox.setAttribute('data-page-num', pageNo);

    // Accurate dimension computation from cached sizes
    const size = this.pageSizes.get(pageNo) || { width: 800, height: 1100, rotate: 0 };
    const totalRotation = ((size.rotate || 0) + this.rotation) % 360;
    const isTransposed = totalRotation === 90 || totalRotation === 270;
    const baseW = isTransposed ? size.height : size.width;
    const baseH = isTransposed ? size.width : size.height;
    const scaledW = Math.floor(baseW * this.zoomScale);
    const scaledH = Math.floor(baseH * this.zoomScale);

    pageBox.style.width = `${scaledW}px`;
    pageBox.style.height = `${scaledH}px`;

    // Skeleton placeholder (prevents visual jump while streaming)
    const placeholder = document.createElement('div');
    placeholder.className = 'pdf-page-placeholder';
    placeholder.innerHTML = `
      <div class="pdf-placeholder-spinner"></div>
      <span>Đang dựng bản vẽ trang ${pageNo}...</span>
    `;
    pageBox.appendChild(placeholder);

    const canvas = document.createElement('canvas');
    canvas.className = 'pdf-render-canvas';
    pageBox.appendChild(canvas);

    // Text layer for selectable text and search highlights
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'textLayer';
    textLayerDiv.setAttribute('data-text-page', pageNo);
    pageBox.appendChild(textLayerDiv);

    // Overlay layer for annotations & measurements
    const overlay = document.createElement('canvas');
    overlay.className = 'pdf-annotation-overlay';
    overlay.setAttribute('data-overlay-page', pageNo);
    pageBox.appendChild(overlay);

    // Page badge indicator
    const pageBadge = document.createElement('div');
    pageBadge.className = 'pdf-page-badge';
    pageBadge.textContent = `PAGE ${String(pageNo).padStart(2, '0')}`;
    pageBox.appendChild(pageBadge);

    this.pageCanvases.set(pageNo, {
      canvas,
      overlay,
      pageBox,
      textLayerDiv,
      placeholder,
      scaledW,
      scaledH
    });

    return pageBox;
  }

  /**
   * Virtualization Observer: Observes page containers entering and exiting the viewport
   */
  setupVirtualizedObserver(wrapper) {
    const options = {
      root: this.container,
      rootMargin: '1000px 0px 1000px 0px', // Buffer 2-3 pages above & below for smooth scrolling
      threshold: 0.05
    };

    this.viewportObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const pageNo = parseInt(entry.target.getAttribute('data-page-num'), 10);
        if (isNaN(pageNo)) continue;

        if (entry.isIntersecting) {
          if (!this.renderedPages.has(pageNo)) {
            this.queuePageRender(pageNo);
          }
          if (entry.intersectionRatio > 0.35 && this.currentPage !== pageNo) {
            this.currentPage = pageNo;
            this.onPageChange(this.currentPage, this.numPages);
          }
        } else {
          // Evict distant offscreen page canvas bitmaps for huge documents (> 8 pages)
          if (this.numPages > this.MAX_CACHED_PAGES && this.renderedPages.size > this.MAX_CACHED_PAGES) {
            const distance = Math.abs(pageNo - this.currentPage);
            if (distance > 3) {
              this.evictPageCanvas(pageNo);
            }
          }
        }
      }
    }, options);

    wrapper.querySelectorAll('.pdf-page-container').forEach(el => this.viewportObserver.observe(el));
  }

  /**
   * Queues a page for rendering, prioritized by distance to current view
   */
  queuePageRender(pageNo, highPriority = false) {
    if (this.renderedPages.has(pageNo)) return;
    if (this.renderQueue.includes(pageNo)) return;

    if (highPriority) {
      this.renderQueue.unshift(pageNo);
    } else {
      this.renderQueue.push(pageNo);
      this.renderQueue.sort((a, b) => Math.abs(a - this.currentPage) - Math.abs(b - this.currentPage));
    }

    this.processRenderQueue();
  }

  async processRenderQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.renderQueue.length > 0) {
      if (this.renderTasks.size >= this.MAX_CONCURRENT_RENDERS) {
        break;
      }
      const pageNo = this.renderQueue.shift();
      const pageInfo = this.pageCanvases.get(pageNo);
      if (!pageInfo || !pageInfo.pageBox) continue;

      this.renderSinglePageCanvas(pageNo, pageInfo.pageBox).then(() => {
        this.processRenderQueue();
      }).catch(() => {
        this.processRenderQueue();
      });
    }

    this.isProcessingQueue = false;
  }

  /**
   * Frees GPU texture memory for an offscreen page
   */
  evictPageCanvas(pageNo) {
    if (!this.renderedPages.has(pageNo)) return;

    const task = this.renderTasks.get(pageNo);
    if (task) {
      try { task.cancel(); } catch {}
      this.renderTasks.delete(pageNo);
    }

    const info = this.pageCanvases.get(pageNo);
    if (info) {
      if (info.canvas) {
        info.canvas.width = 0;
        info.canvas.height = 0;
      }
      if (info.overlay) {
        info.overlay.width = 0;
        info.overlay.height = 0;
      }
      if (info.textLayerDiv) {
        info.textLayerDiv.innerHTML = '';
      }
      if (info.placeholder) {
        info.placeholder.classList.remove('hidden');
      }
    }

    this.renderedPages.delete(pageNo);
  }

  async renderSinglePageCanvas(pageNo, pageContainer) {
    if (this.renderTasks.has(pageNo)) return;
    const pageInfo = this.pageCanvases.get(pageNo);
    if (!pageInfo) return;

    const { canvas, overlay, textLayerDiv, placeholder } = pageInfo;
    const page = await this.pdfDoc.getPage(pageNo);
    const rotationTotal = (page.rotate + this.rotation) % 360;
    const viewport = page.getViewport({ scale: this.zoomScale, rotation: rotationTotal });

    const ctx = canvas.getContext('2d');
    // Cap devicePixelRatio at 2.0 to avoid texture memory explosion on 4K/8K displays
    const dpr = Math.min(window.devicePixelRatio || 1, 2.0);

    // Retina-sharp rendering
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    overlay.width = Math.floor(viewport.width * dpr);
    overlay.height = Math.floor(viewport.height * dpr);
    overlay.style.width = `${Math.floor(viewport.width)}px`;
    overlay.style.height = `${Math.floor(viewport.height)}px`;

    if (textLayerDiv) {
      textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
      textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;
      textLayerDiv.style.setProperty('--scale-factor', viewport.scale);
    }

    pageContainer.style.width = `${Math.floor(viewport.width)}px`;
    pageContainer.style.height = `${Math.floor(viewport.height)}px`;

    ctx.save();
    ctx.scale(dpr, dpr);

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };

    const task = page.render(renderContext);
    this.renderTasks.set(pageNo, task);

    // Render Text Layer asynchronously via PDF.js TextLayer
    let textPromise = Promise.resolve();
    if (textLayerDiv) {
      textLayerDiv.innerHTML = '';
      textPromise = page.getTextContent().then(async (textContent) => {
        try {
          const textLayer = new pdfjsLib.TextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport: viewport
          });
          await textLayer.render();
        } catch (err) {
          console.warn('TextLayer render error on page', pageNo, err);
        }
      });
    }

    try {
      await Promise.all([task.promise, textPromise]);
      this.renderedPages.add(pageNo);
      if (placeholder) {
        placeholder.classList.add('hidden');
      }
    } catch (err) {
      if (err.name !== 'RenderingCancelledException') {
        console.error('Render error on page', pageNo, err);
      }
    } finally {
      ctx.restore();
      this.renderTasks.delete(pageNo);
      // Free page glyph/operator lists in worker
      if (typeof page.cleanup === 'function') {
        page.cleanup();
      }

      // Trigger overlay redraw event if registered
      if (this.onPageRendered && this.renderedPages.has(pageNo)) {
        this.onPageRendered(pageNo, viewport, overlay);
      }
    }
  }

  /**
   * Search for text across document text layers and highlight matches
   */
  searchAndHighlight(query) {
    this.clearSearchHighlights();
    if (!query || !query.trim()) {
      this.searchMatches = [];
      this.currentSearchMatchIndex = -1;
      return { total: 0, current: 0 };
    }

    const trimmed = query.trim();
    const regex = new RegExp(`(${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const matches = [];

    const textLayers = this.container.querySelectorAll('.textLayer');
    textLayers.forEach(layer => {
      const pageNum = parseInt(layer.parentElement.getAttribute('data-page-num'), 10);
      const spans = layer.querySelectorAll('span');
      spans.forEach(span => {
        const text = span.textContent;
        if (regex.test(text)) {
          span.innerHTML = text.replace(regex, '<mark class="search-match">$1</mark>');
          span.querySelectorAll('mark.search-match').forEach(m => {
            matches.push({ el: m, pageNum });
          });
        }
      });
    });

    this.searchMatches = matches;
    if (matches.length > 0) {
      this.currentSearchMatchIndex = 0;
      this.activateSearchMatch(0);
      return { total: matches.length, current: 1 };
    } else {
      this.currentSearchMatchIndex = -1;
      return { total: 0, current: 0 };
    }
  }

  activateSearchMatch(index) {
    if (index < 0 || index >= this.searchMatches.length) return;
    
    this.container.querySelectorAll('.textLayer mark.search-match.current').forEach(m => {
      m.classList.remove('current');
    });

    const match = this.searchMatches[index];
    match.el.classList.add('current');
    match.el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    try {
      const range = document.createRange();
      range.selectNodeContents(match.el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch {}

    if (match.pageNum && match.pageNum !== this.currentPage) {
      this.currentPage = match.pageNum;
      this.onPageChange(this.currentPage, this.numPages);
    }
  }

  nextSearchMatch() {
    if (this.searchMatches.length === 0) return { total: 0, current: 0 };
    this.currentSearchMatchIndex = (this.currentSearchMatchIndex + 1) % this.searchMatches.length;
    this.activateSearchMatch(this.currentSearchMatchIndex);
    return { total: this.searchMatches.length, current: this.currentSearchMatchIndex + 1 };
  }

  prevSearchMatch() {
    if (this.searchMatches.length === 0) return { total: 0, current: 0 };
    this.currentSearchMatchIndex = (this.currentSearchMatchIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
    this.activateSearchMatch(this.currentSearchMatchIndex);
    return { total: this.searchMatches.length, current: this.currentSearchMatchIndex + 1 };
  }

  clearSearchHighlights() {
    if (!this.container) return;
    this.container.querySelectorAll('.textLayer span').forEach(span => {
      if (span.querySelector('mark.search-match')) {
        span.textContent = span.textContent;
      }
    });
    this.searchMatches = [];
    this.currentSearchMatchIndex = -1;
    try {
      window.getSelection()?.removeAllRanges();
    } catch {}
  }
}

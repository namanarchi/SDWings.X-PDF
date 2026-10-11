import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Configure Mozilla PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export class PdfEngine {
  constructor(options = {}) {
    this.container = options.container;
    this.onPageChange = options.onPageChange || (() => {});
    this.onDocLoaded = options.onDocLoaded || (() => {});
    this.onZoomChange = options.onZoomChange || (() => {});
    
    this.pdfDoc = null;
    this.currentDocBuffer = null;
    this.docName = 'Chưa tải';
    this.numPages = 0;
    this.currentPage = 1;
    this.zoomScale = 1.0;
    this.viewMode = 'continuous'; // 'continuous' | 'single' | 'two-up'
    this.layoutCols = 1; // 1, 2, 3, 4 page layout arrangement
    this.rotation = 0; // 0, 90, 180, 270
    this.renderTasks = new Map();
    this.pageCanvases = new Map();
    this.pageSizes = new Map();
    this.outlines = [];
    this.pageTextContent = new Map();

    // In-document text search state
    this.searchMatches = [];
    this.currentSearchMatchIndex = -1;
  }

  async loadFromBuffer(buffer, name = 'document.pdf') {
    // Cancel existing render tasks
    this.cancelAllRenders();

    this.currentDocBuffer = buffer;
    this.docName = name;

    const loadingTask = pdfjsLib.getDocument({
      data: buffer.slice(0),
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/standard_fonts/'
    });

    this.pdfDoc = await loadingTask.promise;
    this.numPages = this.pdfDoc.numPages;
    this.currentPage = 1;
    this.rotation = 0;

    // Cache page dimensions and outlines
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
      this.pageSizes.set(i, { width: viewport.width, height: viewport.height });
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

    // Auto-scale zoom so all columns fit on screen
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

  async render() {
    if (!this.pdfDoc || !this.container) return;
    this.cancelAllRenders();

    this.container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = `pdf-canvas-wrapper view-cols-${this.layoutCols}`;
    this.container.appendChild(wrapper);

    for (let i = 1; i <= this.numPages; i++) {
      const pageContainer = this.createPageContainer(i);
      wrapper.appendChild(pageContainer);
      this.renderSinglePageCanvas(i, pageContainer);
    }
    this.setupIntersectionObserver(wrapper);
  }

  createPageContainer(pageNo) {
    const pageBox = document.createElement('div');
    pageBox.className = 'pdf-page-container';
    pageBox.setAttribute('data-page-num', pageNo);

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

    // Subtle page number stamp at bottom corner
    const pageBadge = document.createElement('div');
    pageBadge.className = 'pdf-page-badge';
    pageBadge.textContent = `PAGE ${String(pageNo).padStart(2, '0')}`;
    pageBox.appendChild(pageBadge);

    this.pageCanvases.set(pageNo, { canvas, overlay, pageBox, textLayerDiv });
    return pageBox;
  }

  async renderSinglePageCanvas(pageNo, pageContainer) {
    const page = await this.pdfDoc.getPage(pageNo);
    const rotationTotal = (page.rotate + this.rotation) % 360;
    const viewport = page.getViewport({ scale: this.zoomScale, rotation: rotationTotal });

    const canvas = pageContainer.querySelector('.pdf-render-canvas');
    const overlay = pageContainer.querySelector('.pdf-annotation-overlay');
    const textLayerDiv = pageContainer.querySelector('.textLayer');
    if (!canvas || !overlay) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

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
    } catch (err) {
      if (err.name !== 'RenderingCancelledException') {
        console.error('Render error:', err);
      }
    } finally {
      ctx.restore();
      this.renderTasks.delete(pageNo);
      // Trigger overlay redraw event if registered
      if (this.onPageRendered) {
        this.onPageRendered(pageNo, viewport, overlay);
      }
    }
  }

  setupIntersectionObserver(wrapper) {
    const options = {
      root: this.container,
      threshold: 0.3
    };

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const pageNo = parseInt(entry.target.getAttribute('data-page-num'), 10);
          if (!isNaN(pageNo) && this.currentPage !== pageNo) {
            this.currentPage = pageNo;
            this.onPageChange(this.currentPage, this.numPages);
          }
        }
      }
    }, options);

    wrapper.querySelectorAll('.pdf-page-container').forEach(el => observer.observe(el));
  }

  /**
   * Search for text across all document text layers and highlight & select matches
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

    // Search across all rendered textLayer divs in the document
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
    
    // Deactivate previous
    this.container.querySelectorAll('.textLayer mark.search-match.current').forEach(m => {
      m.classList.remove('current');
    });

    const match = this.searchMatches[index];
    match.el.classList.add('current');
    match.el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Select the found text using browser Selection API
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

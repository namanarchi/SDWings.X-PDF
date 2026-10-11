/**
 * tabManager.js
 * Multi-document tab manager with native drag-and-drop reordering,
 * per-document state preservation (annotations, zoom, page), and seamless tab switching.
 */

import { applyLucideIcons } from './iconHelper.js';

export class TabManager {
  constructor({ container, onTabChange, onSaveState, onAllTabsClosed, onOpenFiles }) {
    this.container = container;
    this.scrollContainer = container ? container.querySelector('#tabsScrollContainer') : null;
    this.addBtn = container ? container.querySelector('#btnAddNewTab') : null;
    this.onTabChange = onTabChange || (() => {});
    this.onSaveState = onSaveState || (() => {});
    this.onAllTabsClosed = onAllTabsClosed || (() => {});
    this.onOpenFiles = onOpenFiles || (() => {});

    this.tabs = [];
    this.activeTabId = null;
    this.draggedTabId = null;
    this.dragOverTabId = null;
    this.dropPosition = null; // 'before' | 'after'

    this.init();
  }

  init() {
    if (this.addBtn) {
      this.addBtn.onclick = () => {
        this.onOpenFiles();
      };
    }

    // Smooth mouse-wheel horizontal scrolling on tab bar
    if (this.scrollContainer) {
      this.scrollContainer.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          this.scrollContainer.scrollLeft += e.deltaY;
        }
      }, { passive: false });
    }
  }

  getActiveTab() {
    return this.tabs.find(t => t.id === this.activeTabId) || null;
  }

  getTab(tabId) {
    return this.tabs.find(t => t.id === tabId) || null;
  }

  updateActiveTab(partial) {
    const cur = this.getActiveTab();
    if (cur) {
      Object.assign(cur, partial);
    }
  }

  /**
   * Adds a new document tab and optionally switches to it
   */
  async addTab({ name, buffer, numPages = 1, isSample = false, makeActive = true }) {
    const id = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const tab = {
      id,
      name,
      buffer,
      numPages,
      currentPage: 1,
      zoomScale: 1.0,
      layoutCols: 1,
      rotation: 0,
      annotationsByPage: new Map(),
      history: [],
      redoStack: [],
      scaleRatio: 100,
      unit: 'm',
      isSample
    };

    this.tabs.push(tab);
    this.renderTabs();

    if (makeActive || !this.activeTabId) {
      await this.activateTab(id);
    }
    return tab;
  }

  /**
   * Activates a tab by ID, preserving previous tab state and restoring target tab
   */
  async activateTab(tabId) {
    if (this.activeTabId === tabId && this.tabs.some(t => t.id === tabId)) {
      return;
    }

    // 1. Snapshot currently active tab before switching away
    if (this.activeTabId) {
      const cur = this.tabs.find(t => t.id === this.activeTabId);
      if (cur) {
        this.onSaveState(cur);
      }
    }

    this.activeTabId = tabId;
    this.renderTabs();

    // Scroll active tab into view if needed
    if (this.scrollContainer) {
      const activeEl = this.scrollContainer.querySelector(`[data-tab-id="${tabId}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }

    const targetTab = this.tabs.find(t => t.id === tabId);
    if (targetTab) {
      await this.onTabChange(targetTab);
    }
  }

  /**
   * Closes a tab by ID, switching to adjacent tab or triggering all-closed callback
   */
  async closeTab(tabId) {
    const idx = this.tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;

    const closedTab = this.tabs[idx];
    // Explicitly release large ArrayBuffers and memory structures
    closedTab.buffer = null;
    if (closedTab.annotationsByPage) {
      closedTab.annotationsByPage.clear();
      closedTab.annotationsByPage = null;
    }
    closedTab.history = null;
    closedTab.redoStack = null;

    this.tabs.splice(idx, 1);

    if (this.tabs.length === 0) {
      this.activeTabId = null;
      this.renderTabs();
      await this.onAllTabsClosed();
      return;
    }

    if (this.activeTabId === tabId) {
      const nextIdx = Math.min(idx, this.tabs.length - 1);
      const nextTab = this.tabs[nextIdx];
      await this.activateTab(nextTab.id);
    } else {
      this.renderTabs();
    }
  }

  /**
   * Drag-and-drop reordering of tabs in the array
   */
  reorderTabs(sourceId, targetId, position = 'before') {
    const srcIdx = this.tabs.findIndex(t => t.id === sourceId);
    const tgtIdx = this.tabs.findIndex(t => t.id === targetId);
    if (srcIdx === -1 || tgtIdx === -1 || srcIdx === tgtIdx) return;

    const [moved] = this.tabs.splice(srcIdx, 1);
    let newIdx = this.tabs.findIndex(t => t.id === targetId);
    if (position === 'after') {
      newIdx += 1;
    }
    this.tabs.splice(newIdx, 0, moved);

    this.renderTabs();
  }

  /**
   * Sets up HTML5 Drag and Drop event handlers on an individual tab element
   */
  setupTabDrag(tabEl, tabId) {
    tabEl.setAttribute('draggable', 'true');

    tabEl.ondragstart = (e) => {
      this.draggedTabId = tabId;
      tabEl.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', tabId);
    };

    tabEl.ondragover = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!this.draggedTabId || this.draggedTabId === tabId) return;

      const rect = tabEl.getBoundingClientRect();
      const mid = rect.left + rect.width / 2;
      const isBefore = e.clientX < mid;

      this.dragOverTabId = tabId;
      this.dropPosition = isBefore ? 'before' : 'after';

      // Update drop visual indicators
      this.scrollContainer.querySelectorAll('.doc-tab').forEach(t => {
        t.classList.remove('drop-indicator-left', 'drop-indicator-right');
      });
      tabEl.classList.add(isBefore ? 'drop-indicator-left' : 'drop-indicator-right');
    };

    tabEl.ondragleave = (e) => {
      if (e.relatedTarget && tabEl.contains(e.relatedTarget)) return;
      tabEl.classList.remove('drop-indicator-left', 'drop-indicator-right');
    };

    tabEl.ondrop = (e) => {
      e.preventDefault();
      tabEl.classList.remove('drop-indicator-left', 'drop-indicator-right');
      if (!this.draggedTabId || this.draggedTabId === tabId) return;

      this.reorderTabs(this.draggedTabId, tabId, this.dropPosition);
    };

    tabEl.ondragend = () => {
      this.draggedTabId = null;
      this.dragOverTabId = null;
      this.dropPosition = null;
      if (this.scrollContainer) {
        this.scrollContainer.querySelectorAll('.doc-tab').forEach(t => {
          t.classList.remove('is-dragging', 'drop-indicator-left', 'drop-indicator-right');
        });
      }
    };
  }

  /**
   * Renders the tab elements inside the tab container
   */
  renderTabs() {
    if (!this.scrollContainer) return;
    this.scrollContainer.innerHTML = '';

    this.tabs.forEach((tab) => {
      const isActive = tab.id === this.activeTabId;
      const tabEl = document.createElement('div');
      tabEl.className = `doc-tab ${isActive ? 'active' : ''}`;
      tabEl.setAttribute('data-tab-id', tab.id);
      tabEl.title = `${tab.name} (${tab.numPages} trang) - Kéo để đổi vị trí tab`;

      tabEl.innerHTML = `
        <span class="tab-drag-grip" title="Kéo để đổi thứ tự tab">⋮⋮</span>
        <span class="tab-file-icon"><span data-icon="FileText" data-size="13"></span></span>
        <span class="tab-title-text">${tab.name}</span>
        <span class="tab-pages-count">${tab.numPages} tr</span>
        <button class="tab-close-btn" title="Đóng tệp này">✕</button>
      `;

      // Tab selection click
      tabEl.onclick = (e) => {
        if (e.target.closest('.tab-close-btn')) return;
        this.activateTab(tab.id);
      };

      // Tab close button click
      const closeBtn = tabEl.querySelector('.tab-close-btn');
      if (closeBtn) {
        closeBtn.onclick = (e) => {
          e.stopPropagation();
          this.closeTab(tab.id);
        };
      }

      // Drag and drop setup
      this.setupTabDrag(tabEl, tab.id);

      this.scrollContainer.appendChild(tabEl);
    });

    applyLucideIcons(this.scrollContainer);
  }
}

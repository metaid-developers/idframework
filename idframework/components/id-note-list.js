import './id-note-card.js';
import './id-note-empty-state.js';
import { buildNoteRouteUrl } from '../utils/note-route.js';

class IdNoteList extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._watchTimer = null;
    this._lastContextKey = '';
    this._items = [];
    this._loading = false;
    this._error = '';
    this._hasMore = false;
    this._onLocaleChanged = this.render.bind(this);
    this._observer = null;
    this._sentinel = null;
    this._onNoteOpen = this._handleNoteOpen.bind(this);
  }

  static get observedAttributes() {
    return ['mode'];
  }

  connectedCallback() {
    this._ensureStoreShape();
    if (typeof window !== 'undefined' && window && typeof window.addEventListener === 'function') {
      window.addEventListener('id:i18n:changed', this._onLocaleChanged);
    }
    this.render();
    this._checkContext(true);
    this._watchTimer = setInterval(() => this._checkContext(false), 260);
    if (this._watchTimer && typeof this._watchTimer.unref === 'function') this._watchTimer.unref();
    if (typeof this.addEventListener === 'function') {
      this.addEventListener('note-open', this._onNoteOpen);
    }
  }

  disconnectedCallback() {
    if (typeof window !== 'undefined' && window && typeof window.removeEventListener === 'function') {
      window.removeEventListener('id:i18n:changed', this._onLocaleChanged);
    }
    if (this._watchTimer) {
      clearInterval(this._watchTimer);
      this._watchTimer = null;
    }
    this._teardownObserver();
    if (typeof this.removeEventListener === 'function') {
      this.removeEventListener('note-open', this._onNoteOpen);
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === 'mode') {
      this._checkContext(true);
    }
  }

  _t(key, fallback, params) {
    if (
      typeof window !== 'undefined' &&
      window.IDFramework &&
      window.IDFramework.I18n &&
      typeof window.IDFramework.I18n.t === 'function'
    ) {
      return window.IDFramework.I18n.t(key, params || {}, fallback || '');
    }
    return fallback || '';
  }

  _escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  _escapeAttribute(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  _getStore(name) {
    if (typeof Alpine === 'undefined' || typeof Alpine.store !== 'function') return null;
    return Alpine.store(name) || null;
  }

  _normalizeMode(raw) {
    var mode = String(raw || '').trim().toLowerCase();
    if (mode === 'my' || mode === 'mynote') return 'my';
    return 'public';
  }

  _ensureStoreShape() {
    var note = this._getStore('note');
    if (!note) return;
    if (!note.route || typeof note.route !== 'object') note.route = { path: '/', view: 'list', params: {}, query: {} };
    if (!note.publicList || typeof note.publicList !== 'object') note.publicList = {};
    if (!note.myList || typeof note.myList !== 'object') note.myList = {};

    [note.publicList, note.myList].forEach(function ensureListShape(list) {
      if (!Array.isArray(list.items)) list.items = [];
      if (list.cursor === undefined) list.cursor = 0;
      if (list.hasMore === undefined) list.hasMore = true;
      if (list.isLoading === undefined) list.isLoading = false;
      if (list.error === undefined) list.error = '';
    });
  }

  _segmentFromStore() {
    var note = this._getStore('note');
    if (!note) return null;
    var mode = this._normalizeMode(this.getAttribute('mode'));
    return mode === 'my' ? note.myList : note.publicList;
  }

  _contextKey() {
    this._ensureStoreShape();
    var mode = this._normalizeMode(this.getAttribute('mode'));
    var segment = this._segmentFromStore();
    if (!segment) return mode;
    return [
      mode,
      String(segment.items && segment.items.length || 0),
      String(segment.cursor ?? ''),
      segment.hasMore ? '1' : '0',
      segment.isLoading ? '1' : '0',
      String(segment.error || ''),
    ].join('|');
  }

  _checkContext(force) {
    var nextKey = this._contextKey();
    if (!force && nextKey === this._lastContextKey) return;
    this._lastContextKey = nextKey;
    this._syncViewFromStore();
    this.render();
  }

  _syncViewFromStore() {
    var segment = this._segmentFromStore();
    if (!segment) {
      this._items = [];
      this._loading = false;
      this._error = '';
      this._hasMore = false;
      return;
    }
    this._items = Array.isArray(segment.items) ? segment.items.slice() : [];
    this._loading = !!segment.isLoading;
    this._error = String(segment.error || '').trim();
    this._hasMore = !!segment.hasMore;
  }

  _teardownObserver() {
    if (this._observer) {
      try { this._observer.disconnect(); } catch (_) {}
    }
    this._observer = null;
    this._sentinel = null;
  }

  _setupObserver() {
    this._teardownObserver();
    if (typeof IntersectionObserver === 'undefined') return;
    if (!this.shadowRoot || typeof this.shadowRoot.querySelector !== 'function') return;
    var sentinel = this.shadowRoot.querySelector('.sentinel');
    if (!sentinel) return;
    this._sentinel = sentinel;
    this._observer = new IntersectionObserver((entries) => {
      var entry = entries && entries[0] ? entries[0] : null;
      if (!entry || !entry.isIntersecting) return;
      // Pagination wiring happens in later tasks; keep this component presentational for now.
    });
    this._observer.observe(sentinel);
  }

  _renderState() {
    var mode = this._normalizeMode(this.getAttribute('mode'));
    if (this._error) {
      var title = this._t('note.list.errorTitle', 'Failed to load notes');
      return `<id-note-empty-state variant="error" title="${this._escapeAttribute(title)}" message="${this._escapeAttribute(this._error)}"></id-note-empty-state>`;
    }

    if (this._loading && (!this._items || this._items.length === 0)) {
      var loadingTitle = this._t('note.list.loadingTitle', 'Loading');
      var loadingMsg = this._t('note.list.loadingMessage', 'Loading...');
      return `<id-note-empty-state variant="loading" title="${this._escapeAttribute(loadingTitle)}" message="${this._escapeAttribute(loadingMsg)}"></id-note-empty-state>`;
    }

    if (!this._items || this._items.length === 0) {
      var emptyMsg = mode === 'my'
        ? this._t('note.list.emptyMy', 'No notes.')
        : this._t('note.list.emptyPublic', 'No notes.');
      return `<id-note-empty-state variant="empty" title="${this._escapeAttribute(this._t('note.list.emptyTitle', 'No notes'))}" message="${this._escapeAttribute(emptyMsg)}"></id-note-empty-state>`;
    }

    var cardsHtml = this._items.map((item) => {
      var json = '';
      try {
        json = JSON.stringify(item || {});
      } catch (_) {
        json = '{}';
      }
      return `<id-note-card note="${this._escapeAttribute(json)}"></id-note-card>`;
    }).join('');

    var sentinelHtml = this._hasMore ? `<div class="sentinel" aria-hidden="true"></div>` : '';
    return `<div class="grid">${cardsHtml}</div>${sentinelHtml}`;
  }

  _handleNoteOpen(event) {
    var detail = event && event.detail ? event.detail : {};
    var pinId = String(detail.pinId || '').trim();
    if (!pinId || typeof window === 'undefined' || !window.location || !window.history) return;
    var nextUrl = buildNoteRouteUrl(window.location, '/note/' + encodeURIComponent(pinId), window);
    if (typeof window.history.pushState === 'function') {
      window.history.pushState({}, '', nextUrl);
    }
    if (typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('id:note:navigate', {
        detail: { path: '/note/' + pinId },
      }));
    }
  }

  render() {
    if (!this.shadowRoot) return;
    var stateHtml = this._renderState();

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .wrap { display: block; }
        .grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        .sentinel {
          height: 1px;
          width: 100%;
        }
        @media (min-width: 720px) {
          .grid { grid-template-columns: 1fr 1fr; }
        }
      </style>
      <section class="wrap">
        ${stateHtml}
      </section>
    `;

    this._setupObserver();
  }
}

customElements.define('id-note-list', IdNoteList);

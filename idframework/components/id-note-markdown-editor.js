/**
 * id-note-markdown-editor
 * Thin wrapper around Vditor with a safe fallback textarea for non-browser/test envs.
 *
 * Attributes:
 * - value: markdown string
 * - placeholder: placeholder text
 *
 * Events:
 * - input: { value }
 */
let vditorLoadPromise = null;

function finalizeVditorLoadPromise() {
  return vditorLoadPromise.then((loaded) => {
    if (!loaded) vditorLoadPromise = null;
    return loaded;
  });
}

class IdNoteMarkdownEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._value = '';
    this._placeholder = '';
    this._vditor = null;
    this._textareaId = 'md-' + Math.random().toString(36).slice(2);
  }

  static get observedAttributes() {
    return ['value', 'placeholder'];
  }

  connectedCallback() {
    this._value = this.getAttribute('value') || '';
    this._placeholder = this.getAttribute('placeholder') || '';
    this.render();
    this._initEditor();
  }

  disconnectedCallback() {
    if (this._vditor && typeof this._vditor.destroy === 'function') {
      try { this._vditor.destroy(); } catch (_) { /* noop */ }
    }
    this._vditor = null;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === 'value') {
      this._value = newValue || '';
      if (this._vditor && typeof this._vditor.setValue === 'function') {
        this._vditor.setValue(this._value);
      } else {
        this._syncTextareaValue();
      }
    }
    if (name === 'placeholder') {
      this._placeholder = newValue || '';
      this._syncTextareaPlaceholder();
    }
  }

  set value(next) {
    this._value = next == null ? '' : String(next);
    this.setAttribute('value', this._value);
  }

  get value() {
    return this._value;
  }

  set placeholder(next) {
    this._placeholder = next == null ? '' : String(next);
    this.setAttribute('placeholder', this._placeholder);
  }

  get placeholder() {
    return this._placeholder;
  }

  _getVditorCtor() {
    if (typeof window !== 'undefined' && window && window.Vditor) return window.Vditor;
    if (typeof globalThis !== 'undefined' && globalThis.Vditor) return globalThis.Vditor;
    return null;
  }

  _ensureVditorLoaded() {
    if (this._getVditorCtor()) return Promise.resolve(true);
    if (typeof document === 'undefined') return Promise.resolve(false);
    if (!document || typeof document.createElement !== 'function') return Promise.resolve(false);
    if (vditorLoadPromise) {
      return finalizeVditorLoadPromise().then(() => !!this._getVditorCtor());
    }

    var src = '';
    try {
      src = new URL('../vendors/vditor.js', import.meta.url).href;
    } catch (_) {
      return Promise.resolve(false);
    }

    var existingScript = document.querySelector && document.querySelector('script[data-idf-vditor]');
    if (existingScript) {
      vditorLoadPromise = new Promise((resolve) => {
        if (this._getVditorCtor()) {
          resolve(true);
          return;
        }

        var settle = (value) => resolve(value);
        if (typeof existingScript.addEventListener === 'function') {
          existingScript.addEventListener('load', () => settle(true), { once: true });
          existingScript.addEventListener('error', () => settle(false), { once: true });
          return;
        }

        var previousLoad = existingScript.onload;
        var previousError = existingScript.onerror;
        existingScript.onload = (...args) => {
          if (typeof previousLoad === 'function') previousLoad.apply(existingScript, args);
          settle(true);
        };
        existingScript.onerror = (...args) => {
          if (typeof previousError === 'function') previousError.apply(existingScript, args);
          settle(false);
        };
      });
      return finalizeVditorLoadPromise().then(() => !!this._getVditorCtor());
    }

    vditorLoadPromise = new Promise((resolve) => {
      try {
        var script = document.createElement('script');
        script.setAttribute('data-idf-vditor', '1');
        script.src = src;
        script.onload = () => resolve(!!this._getVditorCtor());
        script.onerror = () => resolve(false);
        (document.head || document.body || document.documentElement).appendChild(script);
      } catch (_) {
        resolve(false);
      }
    });

    return finalizeVditorLoadPromise().then(() => !!this._getVditorCtor());
  }

  _syncTextareaValue() {
    if (!this.shadowRoot) return;
    var textarea = this.shadowRoot.querySelector('textarea');
    if (textarea) textarea.value = this._value;
  }

  _syncTextareaPlaceholder() {
    if (!this.shadowRoot) return;
    var textarea = this.shadowRoot.querySelector('textarea');
    if (textarea) textarea.placeholder = this._placeholder;
  }

  async _initEditor() {
    var ok = await this._ensureVditorLoaded();
    var VditorCtor = ok ? this._getVditorCtor() : null;
    if (!VditorCtor) return;
    if (!this.shadowRoot) return;
    var host = this.shadowRoot.querySelector('.host');
    if (!host) return;

    try {
      this._vditor = new VditorCtor(host, {
        height: '360px',
        placeholder: this._placeholder,
        cache: { enable: false },
        value: this._value,
        input: (value) => {
          this._value = value == null ? '' : String(value);
          var EventCtor = (typeof CustomEvent !== 'undefined')
            ? CustomEvent
            : function MockCustomEvent(type, init) {
              return { type: type, detail: init && init.detail, bubbles: !!(init && init.bubbles), composed: !!(init && init.composed) };
            };
          this.dispatchEvent(new EventCtor('input', { detail: { value: this._value }, bubbles: true, composed: true }));
        },
      });
      var textarea = this.shadowRoot.querySelector('textarea');
      if (textarea) textarea.style.display = 'none';
    } catch (_) {
      this._vditor = null;
    }
  }

  render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .fallback {
          width: 100%;
          min-height: 220px;
          resize: vertical;
          box-sizing: border-box;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        }
      </style>
      <div class="host"></div>
      <textarea id="${this._textareaId}" class="fallback" placeholder="${this._escapeAttr(this._placeholder)}"></textarea>
    `;

    var textarea = this.shadowRoot.querySelector('textarea');
    if (textarea) {
      textarea.value = this._value;
      textarea.oninput = (event) => {
        this._value = event && event.target ? String(event.target.value || '') : '';
        var EventCtor = (typeof CustomEvent !== 'undefined')
          ? CustomEvent
          : function MockCustomEvent(type, init) {
            return { type: type, detail: init && init.detail, bubbles: !!(init && init.bubbles), composed: !!(init && init.composed) };
          };
        this.dispatchEvent(new EventCtor('input', { detail: { value: this._value }, bubbles: true, composed: true }));
      };
    }
  }

  _escapeAttr(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

customElements.define('id-note-markdown-editor', IdNoteMarkdownEditor);

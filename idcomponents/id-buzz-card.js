/**
 * id-buzz-card - Web Component for displaying a Buzz card
 * Uses Shadow DOM with CSS Variables for theming
 * Structure (Layout) managed via CSS, Skin (Theme) managed via CSS Variables
 */

class IdBuzzCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes() {
    return ['content', 'author', 'txid'];
  }

  connectedCallback() {
    // Use requestAnimationFrame to ensure attributes are set
    requestAnimationFrame(() => {
      this.render();
    });
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // Always render when any observed attribute changes
    if (oldValue !== newValue) {
      // Use requestAnimationFrame to batch updates
      if (!this._renderScheduled) {
        this._renderScheduled = true;
        requestAnimationFrame(() => {
          this._renderScheduled = false;
          this.render();
        });
      }
    }
  }

  render() {
    const content = this.getAttribute('content') || '';
    const author = this.getAttribute('author') || 'unknown';
    const txid = this.getAttribute('txid') || '';

    // Create card HTML with CSS Variables for theming
    // Structure (Layout) via CSS, Skin (Theme) via CSS Variables
    this.shadowRoot.innerHTML = `
      <style>
        /* Host element styling */
        :host {
          display: block;
          font-family: var(--id-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif);
        }

        /* Card Container - Main wrapper with part attribute for external styling */
        .card-container {
          /* Structure: Layout */
          display: block;
          padding: var(--id-card-padding, 1rem);
          margin-bottom: var(--id-card-margin-bottom, 1rem);
          
          /* Skin: Theme via CSS Variables with fallbacks */
          background-color: var(--id-bg-card, #ffffff);
          border: 1px solid var(--id-border-color, #e5e7eb);
          border-radius: var(--id-radius-card, 0.5rem);
          box-shadow: var(--id-shadow-sm, 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06));
          
          /* Transitions */
          transition: box-shadow var(--id-transition-base, 0.2s);
        }

        .card-container:hover {
          box-shadow: var(--id-shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06));
        }

        /* Content Section */
        .content {
          /* Structure: Layout */
          display: block;
          margin-bottom: var(--id-spacing-md, 0.75rem);
          line-height: var(--id-line-height-tight, 1.5);
          word-wrap: break-word;
          
          /* Skin: Theme */
          color: var(--id-text-main, #1f2937);
          font-size: var(--id-font-size-base, 1rem);
        }

        /* Meta Section - Author and TXID */
        .meta {
          /* Structure: Layout */
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--id-spacing-sm, 0.5rem);
          
          /* Skin: Theme */
          font-size: var(--id-font-size-sm, 0.875rem);
          color: var(--id-text-secondary, #6b7280);
        }

        /* Author Name */
        .author {
          /* Structure: Layout */
          font-weight: var(--id-font-weight-semibold, 600);
          
          /* Skin: Theme */
          color: var(--id-text-author, var(--id-color-primary, #3b82f6));
        }

        /* Transaction ID */
        .txid {
          /* Structure: Layout */
          font-family: monospace;
          font-size: var(--id-font-size-xs, 0.75rem);
          word-break: break-all;
          flex-shrink: 1;
          min-width: 0;
          
          /* Skin: Theme */
          color: var(--id-text-tertiary, #9ca3af);
        }
      </style>
      <div part="card-container" class="card-container">
        <div class="content">${this.escapeHtml(content)}</div>
        <div class="meta">
          <span class="author">@${this.escapeHtml(author)}</span>
          <span class="txid" title="${this.escapeHtml(txid)}">${this.truncateTxid(txid)}</span>
        </div>
      </div>
    `;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  truncateTxid(txid) {
    if (!txid || txid.length <= 12) return txid;
    return `${txid.substring(0, 6)}...${txid.substring(txid.length - 6)}`;
  }
}

// Register the custom element
customElements.define('id-buzz-card', IdBuzzCard);

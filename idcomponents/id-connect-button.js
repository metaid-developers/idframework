/**
 * id-connect-button - Web Component for connecting Metalet wallet
 * Uses Shadow DOM with CSS Variables for theming
 * Structure (Layout) managed via CSS, Skin (Theme) managed via CSS Variables
 */

class IdConnectButton extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._address = null;
    this._isConnecting = false;
  }

  static get observedAttributes() {
    return ['address', 'connected'];
  }

  connectedCallback() {
    // Check if already connected on mount
    this.checkConnection();
    this.render();
  }
 
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      if (!this._renderScheduled) {
        this._renderScheduled = true;
        requestAnimationFrame(() => {
          this._renderScheduled = false;
          this.render();
        });
      }
    }
  }

  async checkConnection() {
    // Check if Metalet is available and already connected
    if (window.metaidwallet) {
      try {
        const isConnected = await window.metaidwallet.isConnected();
        if (isConnected) {
          // Use framework's connectWallet to sync state
          if (window.IDFramework) {
            await window.IDFramework.dispatch('connectWallet');
          }
          
          // Get wallet info from store
          const walletStore = Alpine.store('wallet');
          if (walletStore && walletStore.isConnected && walletStore.address) {
            this._address = walletStore.address;
            this.setAttribute('connected', 'true');
            this.setAttribute('address', walletStore.address);
          }
        }
      } catch (error) {
        console.warn('Failed to check Metalet connection:', error);
      }
    }
  }

  async handleConnect() {
    if (this._isConnecting) return;

    this._isConnecting = true;
    this.render();

    try {
      // Use framework's built-in connectWallet command
      if (window.IDFramework) {
        await window.IDFramework.dispatch('connectWallet');
        
        // Get updated wallet info from store
        const walletStore = Alpine.store('wallet');
        if (walletStore && walletStore.isConnected && walletStore.address) {
          this._address = walletStore.address;
          this.setAttribute('connected', 'true');
          this.setAttribute('address', walletStore.address);
          
          // Dispatch custom event for external listeners
          this.dispatchEvent(new CustomEvent('connected', {
            detail: { 
              address: walletStore.address,
              globalMetaId: walletStore.globalMetaId 
            },
            bubbles: true
          }));
          
          // Auto-fetch chat list if in chat app
          if (walletStore.globalMetaId && window.IDFramework) {
            // Wait a bit for globalMetaId to be fully set
            setTimeout(() => {
              window.IDFramework.dispatch('fetchChatList').catch(err => {
                console.warn('Failed to auto-fetch chat list:', err);
              });
            }, 500);
          }
        }
      } else {
        throw new Error('IDFramework is not available');
      }
    } catch (error) {
      console.error('Failed to connect to Metalet:', error);
      alert(error.message || 'Failed to connect to Metalet wallet. Please try again.');
    } finally {
      this._isConnecting = false;
      this.render();
    }
  }

  handleDisconnect() {
    if (window.metaidwallet) {
      window.metaidwallet.disconnect().then(() => {
        this._address = null;
        this.removeAttribute('connected');
        this.removeAttribute('address');
        
        // Update stores with disconnect status
        if (typeof Alpine !== 'undefined') {
          const walletStore = Alpine.store('wallet');
          const appStore = Alpine.store('app');
          
          if (walletStore) {
            walletStore.isConnected = false;
            walletStore.address = null;
            walletStore.metaid = null;
          }
          
          if (appStore) {
            appStore.isLogin = false;
            appStore.userAddress = null;
          }
        }
        
        // Dispatch custom event for external listeners
        this.dispatchEvent(new CustomEvent('disconnected', {
          bubbles: true
        }));
        
        this.render();
      }).catch(error => {
        console.error('Failed to disconnect from Metalet:', error);
      });
    }
  }

  render() {
    const isConnected = this.hasAttribute('connected') && this.getAttribute('connected') === 'true';
    const address = this.getAttribute('address') || this._address || '';
    const displayAddress = address ? this.formatAddress(address) : '';

    this.shadowRoot.innerHTML = `
      <style>
        /* Host element styling */
        :host {
          display: inline-block;
          font-family: var(--id-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif);
        }

        /* Connect Button - Default State */
        .connect-button {
          /* Structure: Layout */
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--id-spacing-sm, 0.5rem);
          padding: var(--id-spacing-sm, 0.5rem) var(--id-spacing-md, 1rem);
          border: none;
          border-radius: var(--id-radius-button, 0.5rem);
          cursor: pointer;
          transition: background-color var(--id-transition-base, 0.2s), transform var(--id-transition-fast, 0.1s);
          
          /* Skin: Theme */
          background-color: var(--id-bg-button, var(--id-color-primary, #3b82f6));
          color: var(--id-text-inverse, #ffffff);
          font-size: var(--id-font-size-base, 1rem);
          font-weight: var(--id-font-weight-semibold, 600);
        }

        .connect-button:hover:not(:disabled) {
          background-color: var(--id-bg-button-hover, var(--id-color-primary-hover, #2563eb));
          transform: translateY(-1px);
        }

        .connect-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .connect-button:disabled {
          background-color: var(--id-bg-button-disabled, #9ca3af);
          cursor: not-allowed;
          opacity: 0.7;
        }

        /* User Info Container - Connected State */
        .user-info {
          /* Structure: Layout */
          display: inline-flex;
          align-items: center;
          gap: var(--id-spacing-sm, 0.5rem);
          padding: var(--id-spacing-xs, 0.25rem);
          border-radius: var(--id-radius-button, 0.5rem);
          cursor: pointer;
          transition: background-color var(--id-transition-base, 0.2s);
          
          /* Skin: Theme */
          background-color: transparent;
        }

        .user-info:hover {
          background-color: var(--id-bg-card, rgba(0, 0, 0, 0.05));
        }

        /* Avatar */
        .avatar {
          /* Structure: Layout */
          width: 2rem;
          height: 2rem;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
          
          /* Skin: Theme */
          border: 2px solid var(--id-border-color, #e5e7eb);
          background-color: var(--id-bg-card, #ffffff);
        }

        /* Address Display */
        .address {
          /* Structure: Layout */
          display: inline-flex;
          align-items: center;
          font-size: var(--id-font-size-sm, 0.875rem);
          font-weight: var(--id-font-weight-semibold, 600);
          
          /* Skin: Theme */
          color: var(--id-text-main, #1f2937);
        }

        /* Disconnect Button (optional, can be added as a dropdown later) */
        .disconnect-button {
          display: none; /* Hidden for now, can be implemented as dropdown */
        }
      </style>
      ${isConnected ? `
        <div part="user-info" class="user-info" title="Click to disconnect">
          <img part="avatar" class="avatar" src="${this.generateAvatarSVG(address)}" alt="User Avatar" />
          <span part="address" class="address">${this.escapeHtml(displayAddress)}</span>
        </div>
      ` : `
        <button 
          part="connect-button" 
          class="connect-button"
          ${this._isConnecting ? 'disabled' : ''}
        >
          ${this._isConnecting ? 'Connecting...' : 'Connect'}
        </button>
      `}
    `;

    // Attach event listeners after rendering
    if (isConnected) {
      const userInfo = this.shadowRoot.querySelector('.user-info');
      if (userInfo) {
        userInfo.addEventListener('click', () => this.handleDisconnect());
      }
    } else {
      const connectButton = this.shadowRoot.querySelector('.connect-button');
      if (connectButton) {
        connectButton.addEventListener('click', () => this.handleConnect());
      }
    }
  }

  formatAddress(address) {
    if (!address) return '';
    if (address.length <= 12) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }

  getInitials(address) {
    if (!address) return '?';
    // Use first character of address as initial
    const initial = address.charAt(0).toUpperCase();
    // Only allow alphanumeric characters for safety
    return /[A-Z0-9]/.test(initial) ? initial : '?';
  }

  generateAvatarSVG(address) {
    const initial = this.getInitials(address);
    // Encode SVG properly for data URI
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#3b82f6"/><text x="16" y="22" font-size="18" font-weight="bold" text-anchor="middle" fill="white">${this.escapeHtml(initial)}</text></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Register the custom element
customElements.define('id-connect-button', IdConnectButton);


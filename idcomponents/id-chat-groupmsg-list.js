/**
 * id-chat-groupmsg-list
 * Group chat messages list component
 * Displays list of messages for the selected group chat
 * 
 * Attributes:
 * - group-id: Group ID (optional, will use currentConversation from store if not provided)
 */

class IdChatGroupmsgList extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._observer = null;
    this._currentConversation = null;
  }

  connectedCallback() {
    // Initial render
    this.render();
    
    // Wait a bit for Alpine to be ready, then observe store
    setTimeout(() => {
      this._observeStore();
    }, 100);
    
    this._attachScrollListener();
  }

  disconnectedCallback() {
    if (this._observer) {
      this._observer.disconnect();
    }
  }

  /**
   * Observe Alpine store changes
   */
  _observeStore() {
    if (typeof Alpine === 'undefined') {
      // Wait for Alpine
      setTimeout(() => this._observeStore(), 100);
      return;
    }

    const chatStore = Alpine.store('chat');
    if (!chatStore) {
      setTimeout(() => this._observeStore(), 100);
      return;
    }

    // Watch for changes in currentConversation and messages
    const checkStore = () => {
      const newConversation = chatStore.currentConversation;
      const conversationType = chatStore.currentConversationType;
      const messages = newConversation ? (chatStore.messages[newConversation] || []) : [];
      const messagesCount = Array.isArray(messages) ? messages.length : 0;
      
      // Only render if it's a group chat (type=1)
      if (newConversation && String(conversationType) === '1') {
        if (newConversation !== this._currentConversation || messagesCount > 0) {
          this._currentConversation = newConversation;
          this.render();
          this._scrollToBottom();
        }
      } else {
        // Not a group chat or no conversation selected
        if (this._currentConversation !== null) {
          this._currentConversation = null;
          this.render();
        }
      }
    };

    // Initial check
    checkStore();

    // Watch for changes (polling approach since Alpine reactivity might not work in Shadow DOM)
    // Use shorter interval for more responsive updates
    this._observer = setInterval(checkStore, 200);
  }

  /**
   * Attach scroll listener for auto-scroll to bottom
   */
  _attachScrollListener() {
    // This will be called after render
  }

  /**
   * Scroll to bottom of messages
   */
  _scrollToBottom() {
    requestAnimationFrame(() => {
      const container = this.shadowRoot.querySelector('.messages-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }

  render() {
    // Always show loading state initially
    const loadingHTML = `
      <style>
        :host {
          display: block;
          height: 100%;
          width: 100%;
        }
        .messages-container {
          height: 100%;
          overflow-y: auto;
          padding: var(--id-spacing-md, 1rem);
          background-color: var(--id-bg-main, #f9fafb);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .loading-state {
          color: var(--id-text-secondary, #6b7280);
          font-size: 1rem;
        }
      </style>
      <div part="container" class="messages-container">
        <div class="loading-state">Loading messages...</div>
      </div>
    `;

    if (typeof Alpine === 'undefined') {
      this.shadowRoot.innerHTML = loadingHTML;
      console.log('[id-chat-groupmsg-list] Render - Alpine not ready, showing loading');
      return;
    }

    const chatStore = Alpine.store('chat');
    if (!chatStore) {
      this.shadowRoot.innerHTML = loadingHTML.replace('Loading messages...', 'Chat store not available');
      console.log('[id-chat-groupmsg-list] Render - Chat store not available');
      return;
    }

    const currentConversation = chatStore.currentConversation;
    const conversationType = chatStore.currentConversationType;
    const isLoading = chatStore.isLoading || false;
    const error = chatStore.error || null;

    // Only show messages if it's a group chat
    const isGroupChat = String(conversationType) === '1';
    const messages = (currentConversation && isGroupChat) 
      ? (chatStore.messages[currentConversation] || [])
      : [];

    // Ensure messages is an array
    const messagesArray = Array.isArray(messages) ? messages : [];

    // Get current user's metaid for determining if message is own
    const walletStore = Alpine.store('wallet');
    const currentUserMetaId = walletStore?.metaid || null;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          height: 100%;
          width: 100%;
        }

        .messages-container {
          height: 100%;
          overflow-y: auto;
          padding: var(--id-spacing-sm, 0.5rem);
          background-color: #0e1621; /* Telegram dark background */
          background-image: 
            radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.03) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(120, 119, 198, 0.03) 0%, transparent 50%);
        }

        .loading-state {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #708499;
        }

        .error-state {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #ff6b6b;
          padding: var(--id-spacing-md, 1rem);
          text-align: center;
        }

        .empty-state {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #708499;
          text-align: center;
          padding: var(--id-spacing-md, 1rem);
        }

        .messages-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        /* Ensure message bubbles are loaded */
        id-chat-msg-bubble {
          display: block;
          width: 100%;
        }
      </style>
      
      <div part="container" class="messages-container">
        ${isLoading ? `
          <div class="loading-state">Loading messages...</div>
        ` : error ? `
          <div class="error-state">Error: ${this.escapeHtml(error)}</div>
        ` : !currentConversation || !isGroupChat ? `
          <div class="empty-state">
            <div>
              <p>Select a group chat to view messages</p>
            </div>
          </div>
        ` : messagesArray.length === 0 ? `
          <div class="empty-state">
            <div>
              <p>No messages yet</p>
              <p style="font-size: 0.875rem; margin-top: 0.5rem;">Be the first to send a message!</p>
            </div>
          </div>
        ` : `
          <div class="messages-list">
            ${messagesArray.map(msg => {
              const userInfo = msg.userInfo || {};
              const userName = userInfo.name || 'Unknown';
              const userAvatar = userInfo.avatarImage || null;
              const isOwn = currentUserMetaId && userInfo.metaid === currentUserMetaId;
              
              return `
                <id-chat-msg-bubble
                  content="${this.escapeHtml(msg.content || '')}"
                  user-name="${this.escapeHtml(userName)}"
                  user-avatar="${userAvatar ? this.escapeHtml(userAvatar) : ''}"
                  timestamp="${msg.timestamp || ''}"
                  is-own="${isOwn ? 'true' : 'false'}"
                ></id-chat-msg-bubble>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;

    // Load message bubble component if not already loaded
    if (messagesArray.length > 0 && !customElements.get('id-chat-msg-bubble')) {
      import('./id-chat-msg-bubble.js').catch(err => {
        console.warn('Failed to load id-chat-msg-bubble:', err);
      });
    }

    // Scroll to bottom after render
    this._scrollToBottom();
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Auto-register
if (!customElements.get('id-chat-groupmsg-list')) {
  customElements.define('id-chat-groupmsg-list', IdChatGroupmsgList);
}

export default IdChatGroupmsgList;


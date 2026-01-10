/**
 * id-chat-chatlist-panel - Web Component for displaying chat list
 * Uses Shadow DOM with CSS Variables for theming
 * Structure (Layout) managed via CSS, Skin (Theme) managed via CSS Variables
 * Follows IDFramework MVC pattern - View layer only, no business logic
 */

class IdChatChatlistPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes() {
    return ['current-conversation'];
  }

  connectedCallback() {
    requestAnimationFrame(() => {
      this.render();
      this._watchStores();
    });
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

  /**
   * Watch Alpine stores for changes
   */
  _watchStores() {
    if (typeof Alpine === 'undefined') return;

    // Watch chat store for conversation updates
    const chatStore = Alpine.store('chat');
    if (chatStore) {
      // Use Alpine's reactivity to re-render when conversations change
      // This is a simple approach - in production, you might want to use
      // Alpine's $watch or a more sophisticated reactivity system
      this._checkInterval = setInterval(() => {
        const currentConversations = chatStore.conversations || {};
        const currentCount = Object.keys(currentConversations).length;
        
        // Only re-render if conversations changed
        if (this._lastConversationCount !== currentCount) {
          console.log(`[id-chat-chatlist-panel] Conversation count changed: ${this._lastConversationCount} -> ${currentCount}`);
          this._lastConversationCount = currentCount;
          this.render();
        }
      }, 500); // Check more frequently
    }
  }

  disconnectedCallback() {
    if (this._checkInterval) {
      clearInterval(this._checkInterval);
    }
  }

  /**
   * Render the component
   */
  render() {
    const currentConversation = this.getAttribute('current-conversation') || null;

    // Get data from Alpine stores
    let conversations = {};
    let isLoading = false;
    let error = null;
    let userStore = {};

    if (typeof Alpine !== 'undefined') {
      const chatStore = Alpine.store('chat');
      if (chatStore) {
        conversations = chatStore.conversations || {};
        isLoading = chatStore.isLoading || false;
        error = chatStore.error || null;
        
        console.log(`[id-chat-chatlist-panel] Render - conversations count: ${Object.keys(conversations).length}`);
        console.log(`[id-chat-chatlist-panel] Render - isLoading: ${isLoading}, error: ${error}`);
        console.log(`[id-chat-chatlist-panel] Render - conversations:`, conversations);
      } else {
        console.warn('[id-chat-chatlist-panel] Chat store not available');
      }

      const userStoreObj = Alpine.store('user');
      if (userStoreObj) {
        userStore = userStoreObj.users || {};
      }
    }

    // Sort conversations by last message time (most recent first)
    const sortedConversations = Object.entries(conversations).sort((a, b) => {
      const timeA = a[1].lastMessageTime || 0;
      const timeB = b[1].lastMessageTime || 0;
      return timeB - timeA;
    });
    
    console.log(`[id-chat-chatlist-panel] Sorted conversations count: ${sortedConversations.length}`);

    // Create panel HTML with CSS Variables for theming
    this.shadowRoot.innerHTML = `
      <style>
        /* Theme Mapping - Using Global CSS Variables */
        .chatlist-panel {
          /* Structure: Layout */
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          overflow: hidden;
        }

        .chatlist-header {
          /* Structure: Layout */
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--id-spacing-md, 1rem);
          border-bottom: 1px solid var(--id-border-color, #e5e7eb);
          
          /* Skin: Theme */
          background-color: var(--id-bg-card, #ffffff);
        }

        .chatlist-title {
          /* Structure: Layout */
          font-size: 1.5rem;
          font-weight: bold;
          margin: 0;
          
          /* Skin: Theme */
          color: var(--id-text-title, #111827);
        }

        .new-chat-button {
          /* Structure: Layout */
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          cursor: pointer;
          transition: background-color 0.2s;
          
          /* Skin: Theme */
          background-color: var(--id-color-primary, #3b82f6);
          color: var(--id-text-inverse, #ffffff);
        }

        .new-chat-button:hover {
          background-color: var(--id-color-primary-hover, #2563eb);
        }

        .chatlist-content {
          /* Structure: Layout */
          flex: 1;
          overflow-y: auto;
          padding: var(--id-spacing-xs, 0.25rem);
        }

        .chatlist-item {
          /* Structure: Layout */
          display: flex;
          align-items: center;
          gap: var(--id-spacing-sm, 0.5rem);
          padding: var(--id-spacing-sm, 0.5rem);
          border-radius: var(--id-radius-card, 0.5rem);
          cursor: pointer;
          transition: background-color 0.2s;
          margin-bottom: var(--id-spacing-xs, 0.25rem);
          position: relative;
        }

        .chatlist-item:hover {
          background-color: var(--id-bg-body, #f3f4f6);
        }

        .chatlist-item.active {
          background-color: var(--id-color-primary, #3b82f6);
          color: var(--id-text-inverse, #ffffff);
        }

        .chatlist-item-icon {
          /* Structure: Layout */
          width: 48px;
          height: 48px;
          border-radius: 50%;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          font-weight: bold;
          position: relative;
          
          /* Skin: Theme */
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: var(--id-text-inverse, #ffffff);
        }

        .chatlist-item-icon img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }

        .chatlist-item-info {
          /* Structure: Layout */
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .chatlist-item-name {
          /* Structure: Layout */
          font-size: 0.9375rem;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          
          /* Skin: Theme */
          color: var(--id-text-title, #111827);
        }

        .chatlist-item.active .chatlist-item-name {
          color: var(--id-text-inverse, #ffffff);
        }

        .chatlist-item-preview {
          /* Structure: Layout */
          font-size: 0.8125rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          
          /* Skin: Theme */
          color: var(--id-text-secondary, #6b7280);
        }

        .chatlist-item.active .chatlist-item-preview {
          color: var(--id-text-inverse, #ffffff);
          opacity: 0.9;
        }

        .chatlist-item-meta {
          /* Structure: Layout */
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.25rem;
          flex-shrink: 0;
        }

        .chatlist-item-time {
          /* Structure: Layout */
          font-size: 0.75rem;
          
          /* Skin: Theme */
          color: var(--id-text-tertiary, #9ca3af);
        }

        .chatlist-item.active .chatlist-item-time {
          color: var(--id-text-inverse, #ffffff);
          opacity: 0.9;
        }

        .chatlist-item-badge {
          /* Structure: Layout */
          background-color: var(--id-color-primary, #3b82f6);
          color: var(--id-text-inverse, #ffffff);
          border-radius: 12px;
          padding: 2px 8px;
          font-size: 0.75rem;
          font-weight: bold;
          min-width: 20px;
          text-align: center;
        }

        .chatlist-item.active .chatlist-item-badge {
          background-color: var(--id-text-inverse, #ffffff);
          color: var(--id-color-primary, #3b82f6);
        }

        .empty-state {
          /* Structure: Layout */
          padding: var(--id-spacing-md, 1rem);
          text-align: center;
          
          /* Skin: Theme */
          color: var(--id-text-secondary, #6b7280);
        }

        .loading-state {
          /* Structure: Layout */
          padding: var(--id-spacing-md, 1rem);
          text-align: center;
          
          /* Skin: Theme */
          color: var(--id-text-secondary, #6b7280);
        }

        .error-state {
          /* Structure: Layout */
          padding: var(--id-spacing-md, 1rem);
          text-align: center;
          
          /* Skin: Theme */
          color: var(--id-text-error, #991b1b);
        }
      </style>
      
      <div part="panel-container" class="chatlist-panel">
        <header class="chatlist-header">
          <h2 class="chatlist-title">Chat</h2>
          <button class="new-chat-button" title="New Chat">+</button>
        </header>
        
        <div class="chatlist-content">
          ${isLoading ? `
            <div class="loading-state">Loading conversations...</div>
          ` : error ? `
            <div class="error-state">Error: ${this.escapeHtml(error)}</div>
          ` : sortedConversations.length === 0 ? `
            <div class="empty-state">
              <p>No conversations yet</p>
              <p style="font-size: 0.875rem; margin-top: 0.5rem;">Start a new chat to begin messaging</p>
            </div>
          ` : sortedConversations.map(([metaid, conversation]) => {
            const isGroupChat = conversation.type === '1';
            const isPrivateChat = conversation.type === '2';
            
            // Determine name and avatar based on chat type
            let userName;
            let userAvatar;
            
            if (isGroupChat) {
              // Group chat: use conversation.name and conversation.avatar directly
              userName = conversation.name || 'Unnamed Group';
              userAvatar = conversation.avatar || null;
            } else if (isPrivateChat) {
              // Private chat: prefer userStore, fallback to conversation data
              const userInfo = userStore[conversation.participantMetaId || metaid] || {};
              userName = userInfo.name || conversation.name || this.truncateMetaId(metaid);
              userAvatar = userInfo.avatarUrl || conversation.avatar || null;
            } else {
              // Fallback: try userStore first, then conversation
              const userInfo = userStore[metaid] || {};
              userName = userInfo.name || conversation.name || this.truncateMetaId(metaid);
              userAvatar = userInfo.avatarUrl || conversation.avatar || null;
            }
            
            const isActive = currentConversation === metaid;
            const lastMessage = conversation.lastMessage || 'No messages yet';
            const lastMessageTime = conversation.lastMessageTime ? this.formatTime(conversation.lastMessageTime) : '';
            const unreadCount = conversation.unreadCount || 0;
            
            // Get first letter for icon
            const iconLetter = userName.charAt(0).toUpperCase();
            
            return `
              <div 
                class="chatlist-item ${isActive ? 'active' : ''}" 
                data-metaid="${this.escapeHtml(metaid)}"
                data-groupid="${conversation.groupId ? this.escapeHtml(conversation.groupId) : ''}"
                data-type="${conversation.type ? this.escapeHtml(conversation.type) : '2'}"
                data-index="${conversation.index !== undefined ? this.escapeHtml(conversation.index) : ''}"
                part="chat-item"
              >
                <div class="chatlist-item-icon">
                  ${userAvatar ? `
                    <img src="${this.escapeHtml(userAvatar)}" alt="${this.escapeHtml(userName)}" 
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                    <span style="display: none;">${iconLetter}</span>
                  ` : `
                    <span>${iconLetter}</span>
                  `}
                </div>
                <div class="chatlist-item-info">
                  <div class="chatlist-item-name">${this.escapeHtml(userName)}</div>
                  <div class="chatlist-item-preview">${this.escapeHtml(lastMessage)}</div>
                </div>
                <div class="chatlist-item-meta">
                  ${lastMessageTime ? `<div class="chatlist-item-time">${lastMessageTime}</div>` : ''}
                  ${unreadCount > 0 ? `<div class="chatlist-item-badge">${unreadCount}</div>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Attach click event listeners
    this._attachEventListeners();
  }

  /**
   * Attach click event listeners to chat items
   */
  _attachEventListeners() {
    const items = this.shadowRoot.querySelectorAll('.chatlist-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const metaid = item.getAttribute('data-metaid');
        const groupId = item.getAttribute('data-groupid');
        const type = item.getAttribute('data-type');
        const index = item.getAttribute('data-index');
        
        if (metaid && window.IDFramework) {
          // Get conversation data from store
          const chatStore = Alpine.store('chat');
          const conversation = chatStore?.conversations?.[metaid];
          
          // Prepare payload with all necessary information
          const payload = {
            metaid: metaid,
            groupId: groupId || conversation?.groupId || null,
            type: type || conversation?.type || '2',
            index: index !== null ? parseInt(index) : (conversation?.index !== undefined ? conversation.index : null)
          };
          
          // Dispatch selectConversation event
          window.IDFramework.dispatch('selectConversation', payload);
          
          // Update attribute
          this.setAttribute('current-conversation', metaid);
          
          // Dispatch custom event for mobile drawer
          this.dispatchEvent(new CustomEvent('conversation-selected', {
            detail: { metaid, ...payload },
            bubbles: true,
            composed: true,
          }));
        }
      });
    });
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  truncateMetaId(metaid) {
    if (!metaid || metaid.length <= 16) return metaid;
    return `${metaid.substring(0, 8)}...${metaid.substring(metaid.length - 8)}`;
  }

  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }
}

// Auto-register
if (!customElements.get('id-chat-chatlist-panel')) {
  customElements.define('id-chat-chatlist-panel', IdChatChatlistPanel);
}


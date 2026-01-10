/**
 * Chat Application Configuration, ServiceLocator, & Initialization
 * 
 * This file contains:
 * - ServiceLocator: Service endpoint configuration (reuses global ServiceLocator)
 * - Application-specific Models: Chat-specific models
 * - Command Registration: Register chat application commands
 * - Application Initialization: Startup logic
 */

// ============================================
// ServiceLocator - Service Endpoint Configuration
// ============================================
// Reuse global ServiceLocator if available, or define for chat app
if (!window.ServiceLocator) {
  window.ServiceLocator = {
    metaid_man: 'https://manapi.metaid.io', // MetaID data indexer API
    metafs: 'https://file.metaid.io/metafile-indexer/api', // MetaFS service for user info and avatars
  };
}

// ============================================
// Application-Specific Models
// ============================================
// ChatModel is already registered in chat.html's alpine:init
// This ensures consistency with framework initialization

// ============================================
// Framework Initialization
// ============================================
// Wait for DOM and Alpine to be ready
document.addEventListener('DOMContentLoaded', async () => {
  // Wait for Alpine to be ready
  if (typeof Alpine === 'undefined') {
    await new Promise(resolve => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve);
      } else {
        resolve();
      }
    });
    
    // Wait for Alpine
    await new Promise(resolve => {
      const checkAlpine = setInterval(() => {
        if (typeof Alpine !== 'undefined') {
          clearInterval(checkAlpine);
          resolve();
        }
      }, 10);
    });
  }

  // Initialize IDFramework
  if (typeof IDFramework !== 'undefined') {
    IDFramework.init();
  } else {
    // Wait for framework to load
    await new Promise(resolve => {
      const checkFramework = setInterval(() => {
        if (typeof IDFramework !== 'undefined') {
          clearInterval(checkFramework);
          IDFramework.init();
          resolve();
        }
      }, 10);
    });
  }

  // ============================================
  // Command Registration
  // ============================================
  // Register chat-specific commands
  // These commands handle chat application logic
  
  // Select conversation command
  IDFramework.IDController.register('selectConversation', './commands/SelectConversationCommand.js');
  
  // Send message command
  IDFramework.IDController.register('sendMessage', './commands/SendMessageCommand.js');
  
  // Fetch chat list command (for loading chat list from IDChat API)
  IDFramework.IDController.register('fetchChatList', './commands/FetchChatListCommand.js');
  
  // Fetch group messages command
  IDFramework.IDController.register('fetchGroupMessages', './commands/FetchGroupMessagesCommand.js');
  
  // Fetch conversations command (for loading chat list - legacy, kept for compatibility)
  IDFramework.IDController.register('fetchConversations', './commands/FetchConversationsCommand.js');
  
  // Reuse existing commands
  IDFramework.IDController.register('fetchUser', './commands/FetchUserCommand.js');

  // ============================================
  // Application Startup Tasks
  // ============================================
  // Load required components dynamically
  
  // Load connect button component
  try {
    await IDFramework.loadComponent('./idcomponents/id-connect-button.js');
    console.log('Connect button component loaded successfully');
  } catch (error) {
    console.error('Failed to load connect button component:', error);
  }
  
  // Load user info float panel component
  try {
    await IDFramework.loadComponent('./idcomponents/id-userinfo-float-panel.js');
    console.log('User info float panel component loaded successfully');
  } catch (error) {
    console.error('Failed to load user info float panel component:', error);
  }
  
  // Load chat list panel component
  try {
    await IDFramework.loadComponent('./idcomponents/id-chat-chatlist-panel.js');
    console.log('Chat list panel component loaded successfully');
  } catch (error) {
    console.error('Failed to load chat list panel component:', error);
  }
  
  // Load group messages list component
  try {
    await IDFramework.loadComponent('./idcomponents/id-chat-groupmsg-list.js');
    console.log('Group messages list component loaded successfully');
  } catch (error) {
    console.error('Failed to load group messages list component:', error);
  }
  
  // Load message bubble component
  try {
    await IDFramework.loadComponent('./idcomponents/id-chat-msg-bubble.js');
    console.log('Message bubble component loaded successfully');
  } catch (error) {
    console.error('Failed to load message bubble component:', error);
  }
  
  // Ensure chat store is initialized (with all required fields)
  if (typeof Alpine !== 'undefined') {
    const chatStore = Alpine.store('chat');
    if (chatStore) {
      // Ensure new fields exist
      if (chatStore.currentConversationId === undefined) {
        chatStore.currentConversationId = null;
      }
      if (chatStore.currentConversationType === undefined) {
        chatStore.currentConversationType = null;
      }
      if (chatStore.currentConversationIndex === undefined) {
        chatStore.currentConversationIndex = null;
      }
    } else {
      Alpine.store('chat', {
        conversations: {},
        currentConversation: null,
        currentConversationId: null,
        currentConversationType: null,
        currentConversationIndex: null,
        messages: {},
        isLoading: false,
        error: null,
      });
      console.log('Chat store initialized in chat.js');
    }
  }
  
  // Listen for wallet connection to auto-fetch chat list
  const walletStore = Alpine.store('wallet');
  if (walletStore && walletStore.isConnected && walletStore.globalMetaId) {
    // Already connected, fetch chat list
    console.log('Wallet already connected, fetching chat list...');
    await IDFramework.dispatch('fetchChatList');
  } else {
    // Watch for wallet connection
    const checkConnection = setInterval(() => {
      const ws = Alpine.store('wallet');
      if (ws && ws.isConnected && ws.globalMetaId) {
        clearInterval(checkConnection);
        console.log('Wallet connected, fetching chat list...');
        IDFramework.dispatch('fetchChatList').catch(err => {
          console.error('Failed to fetch chat list:', err);
        });
      }
    }, 500);
    
    // Stop checking after 30 seconds
    setTimeout(() => clearInterval(checkConnection), 30000);
  }
  
  // Also listen to connect button events
  document.addEventListener('connected', async (e) => {
    console.log('Connected event received, waiting for globalMetaId...');
    // Wait a bit for globalMetaId to be set
    setTimeout(async () => {
      const ws = Alpine.store('wallet');
      if (ws && ws.globalMetaId) {
        console.log('GlobalMetaId available, fetching chat list...', ws.globalMetaId);
        await IDFramework.dispatch('fetchChatList');
      } else {
        console.warn('GlobalMetaId not available after connection event');
      }
    }, 1000); // Increased delay to ensure globalMetaId is set
  });
});


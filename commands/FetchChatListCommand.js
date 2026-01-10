/**
 * FetchChatListCommand
 * Fetches the latest chat info list from IDChat API
 * Follows IDFramework Command Pattern
 * 
 * API Endpoint: /group-chat/user/latest-chat-info-list
 * Method: GET
 * Headers: Authorization: Bearer {globalMetaId}
 */

export default class FetchChatListCommand {
  /**
   * Convert metafile:// protocol URL to actual file URL
   * @param {string} metafileUrl - URL in format metafile://{pinid}
   * @returns {string} - Full URL to access the file
   */
  _convertMetafileUrl(metafileUrl) {
    if (!metafileUrl || typeof metafileUrl !== 'string') {
      return null;
    }
    
    if (metafileUrl.startsWith('metafile://')) {
      // Extract pinid from metafile://{pinid}
      const pinid = metafileUrl.replace('metafile://', '');
      
      // Get metafs base URL from ServiceLocator
      const metafsBase = window.ServiceLocator?.metafs || 'https://file.metaid.io/metafile-indexer/api';
      
      // Build full URL: {metafs}/v1/files/content/{pinid}
      return `${metafsBase}/v1/files/content/${pinid}`;
    }
    
    // If already a full URL, return as is
    if (metafileUrl.startsWith('http://') || metafileUrl.startsWith('https://')) {
      return metafileUrl;
    }
    
    // Return as is for other cases
    return metafileUrl;
  }

  /**
   * @param {Object} context
   * @param {Object} context.payload - Event detail (optional)
   * @param {Object} context.stores - Alpine stores object (wallet, chat, user, etc.)
   * @param {Object} context.delegate - IDFramework.Delegate
   */
  async execute({ payload, stores, delegate }) {
    try {
      // Get stores - handle both cases where stores might not be passed correctly
      const walletStore = stores?.wallet || (typeof Alpine !== 'undefined' ? Alpine.store('wallet') : null);
      const chatStore = stores?.chat || (typeof Alpine !== 'undefined' ? Alpine.store('chat') : null);
      
      if (!walletStore || !walletStore.isConnected) {
        console.warn('FetchChatListCommand: Wallet not connected');
        return;
      }

      if (!walletStore.globalMetaId) {
        console.warn('FetchChatListCommand: GlobalMetaID not available. Please connect wallet first.');
        return;
      }

      if (!chatStore) {
        console.warn('FetchChatListCommand: Chat store not available');
        // Try to get it directly from Alpine
        if (typeof Alpine !== 'undefined') {
          const directChatStore = Alpine.store('chat');
          if (directChatStore) {
            directChatStore.isLoading = true;
            directChatStore.error = null;
          }
        }
        return;
      }

      chatStore.isLoading = true;
      chatStore.error = null;

      // Fetch chat list from IDChat API
      // API endpoint: /user/latest-chat-info-list?metaid={globalMetaId}
      const baseURL = window.ServiceLocator?.idchat || 'https://api.idchat.io/chat-api/group-chat';
      const endpoint = `/user/latest-chat-info-list?metaid=${encodeURIComponent(walletStore.globalMetaId)}`;
      
      // Use fetch directly
      const response = await fetch(`${baseURL}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const rawData = await response.json();

      // Parse and update chat store
      const conversations = this._parseChatList(rawData);
      
      // Update chat store - use Object.assign to ensure Alpine reactivity
      Object.assign(chatStore, {
        conversations: conversations,
        isLoading: false,
        error: null,
      });

      // Fetch user info for each conversation participant
      const userStore = stores?.user || (typeof Alpine !== 'undefined' ? Alpine.store('user') : null);
      if (userStore) {
        // Extract unique metaids from conversations
        const metaids = new Set();
        Object.values(conversations).forEach(conv => {
          if (conv.participants) {
            conv.participants.forEach(p => {
              if (p.metaid && p.metaid !== walletStore.globalMetaId) {
                metaids.add(p.metaid);
              }
            });
          }
        });

        // Fetch user info for each metaid
        for (const metaid of metaids) {
          if (!userStore.users[metaid]) {
            if (window.IDFramework) {
              window.IDFramework.dispatch('fetchUser', { metaid }).catch(err => {
                console.warn(`Failed to fetch user info for ${metaid}:`, err);
              });
            }
          }
        }
      }

    } catch (error) {
      console.error('FetchChatListCommand error:', error);
      const chatStore = stores?.chat || (typeof Alpine !== 'undefined' ? Alpine.store('chat') : null);
      if (chatStore) {
        chatStore.isLoading = false;
        chatStore.error = error.message || 'Failed to fetch chat list';
      } else {
        console.error('FetchChatListCommand: Cannot update chat store - store not available');
      }
    }
  }

  /**
   * Parse raw API response into conversation format
   * @param {Object} rawData - Raw API response
   * @returns {Object} Parsed conversations object
   */
  _parseChatList(rawData) {
    const conversations = {};


    // Handle different API response structures
    let chatList = [];
    if (Array.isArray(rawData)) {
      chatList = rawData;
    } else if (rawData.data) {
      // data might be an object with a list property, or it might be an array
      if (Array.isArray(rawData.data)) {
        chatList = rawData.data;
      } else if (rawData.data.list && Array.isArray(rawData.data.list)) {
        chatList = rawData.data.list;
      } else if (rawData.data.items && Array.isArray(rawData.data.items)) {
        chatList = rawData.data.items;
      } else if (rawData.data.data && Array.isArray(rawData.data.data)) {
        chatList = rawData.data.data;
      } else if (rawData.data.chats && Array.isArray(rawData.data.chats)) {
        chatList = rawData.data.chats;
      } else if (rawData.data.conversations && Array.isArray(rawData.data.conversations)) {
        chatList = rawData.data.conversations;
      } else {
        // If data is an object, try to find any array property
        for (const key in rawData.data) {
          if (Array.isArray(rawData.data[key])) {
            chatList = rawData.data[key];
            break;
          }
        }
      }
    } else if (rawData.list && Array.isArray(rawData.list)) {
      chatList = rawData.list;
    } else if (rawData.result && Array.isArray(rawData.result)) {
      chatList = rawData.result;
    } else if (rawData.items && Array.isArray(rawData.items)) {
      chatList = rawData.items;
    }

    // Parse chat list based on type (1=group, 2=private)

    chatList.forEach((chat, index) => {
      
      // Determine chat type: type=1 is group chat, type=2 is private chat
      const chatType = String(chat.type || chat.chatType || chat.chat_type || '2');
      const isGroupChat = chatType === '1';
      const isPrivateChat = chatType === '2';
      
      // Extract conversation ID based on chat type
      let conversationId;
      let conversationKey;
      let conversationName;
      let conversationAvatar;
      let participantMetaId = null;
      
      if (isGroupChat) {
        // Group chat: use groupId as conversationId
        conversationId = chat.groupId || chat.group_id || `group_${index}`;
        conversationKey = conversationId;
        conversationName = chat.roomName || chat.room_name || 'Unnamed Group';
        
        // Handle roomIcon (may be in metafile:// format)
        if (chat.roomIcon) {
          conversationAvatar = this._convertMetafileUrl(chat.roomIcon);
        }
      } else if (isPrivateChat) {
        // Private chat: use metaId or globalMetaId as conversationId
        conversationId = chat.metaId || chat.meta_id || chat.globalMetaId || chat.global_meta_id || `private_${index}`;
        conversationKey = conversationId;
        participantMetaId = chat.metaId || chat.meta_id || null;
        
        // For private chats, name and avatar come from userInfo
        if (chat.userInfo) {
          conversationName = chat.userInfo.name || null;
          conversationAvatar = chat.userInfo.avatarImage || null;
          
          // If we have userInfo, dispatch fetchUser to ensure user data is in store
          if (participantMetaId) {
            setTimeout(() => {
              IDFramework.dispatch('fetchUser', { metaid: participantMetaId });
            }, 0);
          }
        }
      } else {
        // Fallback: use generic ID
        conversationId = chat.conversationId || chat.conversation_id || chat.id || `chat_${index}`;
        conversationKey = conversationId;
        conversationName = chat.name || chat.title || null;
      }
      
      // Last message - could be an object or string
      // For this API, the content field seems to be a hash, not the actual message
      // We might need to fetch the actual message later, but for now use content if available
      let lastMessage = null;
      if (chat.content && typeof chat.content === 'string' && chat.content.length < 100) {
        // If content looks like a hash, we'll skip it for now
        // In a real implementation, we'd fetch the actual message content
        lastMessage = null; // Will be fetched separately if needed
      } else if (chat.lastMessage) {
        lastMessage = typeof chat.lastMessage === 'string' 
          ? chat.lastMessage 
          : (chat.lastMessage.content || chat.lastMessage.text || chat.lastMessage.message || null);
      } else if (chat.last_message) {
        lastMessage = typeof chat.last_message === 'string'
          ? chat.last_message
          : (chat.last_message.content || chat.last_message.text || chat.last_message.message || null);
      }
      
      // Last message time - use timestamp field
      let lastMessageTime = null;
      if (chat.timestamp) {
        lastMessageTime = typeof chat.timestamp === 'number'
          ? chat.timestamp
          : new Date(chat.timestamp).getTime();
      } else if (chat.lastMessageTime) {
        lastMessageTime = typeof chat.lastMessageTime === 'number' 
          ? chat.lastMessageTime 
          : new Date(chat.lastMessageTime).getTime();
      } else if (chat.last_message_time) {
        lastMessageTime = typeof chat.last_message_time === 'number'
          ? chat.last_message_time
          : new Date(chat.last_message_time).getTime();
      }
      
      // Unread count - not directly available in this API response, default to 0
      const unreadCount = chat.unreadCount || chat.unread_count || chat.unread || 0;
      
      // Get participants (for group chats, this might be in userCount)
      const participants = chat.participants || chat.members || chat.users || [];

      conversations[conversationKey] = {
        conversationId: conversationId,
        metaid: conversationKey,
        groupId: isGroupChat ? conversationId : null, // For group chats, store groupId
        type: chatType, // Store the type for component rendering
        index: chat.index !== undefined ? chat.index : null, // Store index for fetching messages
        participants: participants,
        lastMessage: lastMessage,
        lastMessageTime: lastMessageTime || Date.now(),
        unreadCount: unreadCount,
        // Chat-specific fields
        name: conversationName, // Group name or user name
        avatar: conversationAvatar, // Group icon or user avatar
        participantMetaId: participantMetaId, // For private chats, the other user's metaid
        // Additional fields
        chatType: chat.chatType || chat.chat_type || chatType,
        // Store raw chat data for reference
        _raw: chat,
      };
      
    });

    return conversations;
  }
}


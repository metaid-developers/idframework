/**
 * FetchGroupMessagesCommand
 * Fetches group chat messages from IDChat API
 * Follows IDFramework Command Pattern
 * 
 * API Endpoint: /group-chat/group-chat-list-by-index
 * Method: GET
 * Parameters: groupId, startIndex, size
 */

export default class FetchGroupMessagesCommand {
  /**
   * Decrypt AES encrypted content
   * @param {string} encryptedContent - Base64 encoded encrypted content
   * @param {string} key - AES key (16 bytes for AES-128)
   * @returns {Promise<string>} - Decrypted plain text
   */
  async _decryptAES(encryptedContent, key) {
    try {
      if (!encryptedContent || typeof encryptedContent !== 'string') {
        return encryptedContent || '';
      }

      // Ensure key is exactly 16 bytes (AES-128)
      // Use first 16 characters of groupId as key
      const keyString = key.substring(0, 16).padEnd(16, '0');
      const keyBytes = new TextEncoder().encode(keyString);
      
      // Decode encrypted content - try base64 first, then hex
      let encryptedBytes;
      try {
        // Try base64 first
        encryptedBytes = Uint8Array.from(atob(encryptedContent), c => c.charCodeAt(0));
      } catch (e) {
        // If not base64, try hex format
        try {
          // Check if it looks like hex (only contains 0-9, a-f, A-F)
          if (/^[0-9a-fA-F]+$/.test(encryptedContent)) {
            // Convert hex string to bytes
            encryptedBytes = new Uint8Array(encryptedContent.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
          } else {
            console.warn('Content is not base64 or hex, returning as is');
            return encryptedContent;
          }
        } catch (e2) {
          console.warn('Failed to decode content as base64 or hex, returning as is');
          return encryptedContent;
        }
      }
      
      if (encryptedBytes.length < 16) {
        console.warn('Encrypted content too short, returning as is');
        return encryptedContent;
      }
      
      // Import key
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-CBC', length: 128 },
        false,
        ['decrypt']
      );
      
      // Extract IV (first 16 bytes) and ciphertext (rest)
      const iv = encryptedBytes.slice(0, 16);
      const ciphertext = encryptedBytes.slice(16);
      
      if (ciphertext.length === 0) {
        console.warn('No ciphertext after IV, returning as is');
        return encryptedContent;
      }
      
      // Decrypt
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-CBC', iv: iv },
        cryptoKey,
        ciphertext
      );
      
      // Convert to string and remove padding
      const decryptedText = new TextDecoder().decode(decrypted);
      // Remove PKCS7 padding if present
      return decryptedText.replace(/\0+$/, '');
    } catch (error) {
      console.warn('AES decryption failed:', error, 'Content:', encryptedContent?.substring(0, 50));
      // Return original content if decryption fails
      return encryptedContent || '';
    }
  }

  /**
   * @param {Object} context
   * @param {Object} context.payload - Event detail { groupId, startIndex, size }
   * @param {Object} context.stores - Alpine stores object (wallet, chat, user, etc.)
   * @param {Object} context.delegate - IDFramework.Delegate
   */
  async execute({ payload, stores, delegate }) {
    try {
      const { groupId, startIndex, size = 50 } = payload;
      
      if (!groupId) {
        console.warn('FetchGroupMessagesCommand: No groupId provided');
        return;
      }

      // Get stores
      const chatStore = stores?.chat || (typeof Alpine !== 'undefined' ? Alpine.store('chat') : null);
      if (!chatStore) {
        console.warn('FetchGroupMessagesCommand: Chat store not available');
        return;
      }

      // Set loading state
      chatStore.isLoading = true;
      chatStore.error = null;

      // Get API base URL
      const baseURL = window.ServiceLocator?.idchat || 'https://api.idchat.io/chat-api/group-chat';
      
      // Build API endpoint
      const endpoint = `${baseURL}/group-chat-list-by-index?groupId=${encodeURIComponent(groupId)}&startIndex=${startIndex || 0}&size=${size}`;
      
      // Fetch messages
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const rawData = await response.json();
      
      // Parse messages (await the async function)
      const messages = await this._parseMessages(rawData, groupId);

      // Update chat store
      const conversationKey = groupId;
      
      // Replace messages instead of merging (to ensure all messages are shown)
      // Sort by timestamp (oldest first)
      const sortedMessages = messages.sort((a, b) => a.timestamp - b.timestamp);
      
      // Use Object.assign to ensure Alpine reactivity
      Object.assign(chatStore.messages, {
        [conversationKey]: sortedMessages
      });

      // Update loading state
      chatStore.isLoading = false;

      // Fetch user info for message senders
      const userStore = stores?.user || (typeof Alpine !== 'undefined' ? Alpine.store('user') : null);
      if (userStore && window.IDFramework) {
        const uniqueMetaIds = new Set();
        messages.forEach(msg => {
          if (msg.userInfo?.metaid) {
            uniqueMetaIds.add(msg.userInfo.metaid);
          }
        });
        
        uniqueMetaIds.forEach(metaid => {
          if (!userStore.users[metaid]) {
            setTimeout(() => {
              window.IDFramework.dispatch('fetchUser', { metaid }).catch(err => {
                console.warn(`Failed to fetch user info for ${metaid}:`, err);
              });
            }, 0);
          }
        });
      }

    } catch (error) {
      console.error('FetchGroupMessagesCommand error:', error);
      const chatStore = stores?.chat || (typeof Alpine !== 'undefined' ? Alpine.store('chat') : null);
      if (chatStore) {
        chatStore.isLoading = false;
        chatStore.error = error.message || 'Failed to fetch group messages';
      }
    }
  }

  /**
   * Parse API response and decrypt messages
   * @param {Object} rawData - API response
   * @param {string} groupId - Group ID for decryption key
   * @returns {Promise<Array>} - Parsed messages
   */
  async _parseMessages(rawData, groupId) {
    // Extract messages list from API response
    let messageList = [];
    if (Array.isArray(rawData)) {
      messageList = rawData;
    } else if (rawData.data) {
      if (Array.isArray(rawData.data)) {
        messageList = rawData.data;
      } else if (rawData.data.list && Array.isArray(rawData.data.list)) {
        messageList = rawData.data.list;
      } else if (rawData.data.items && Array.isArray(rawData.data.items)) {
        messageList = rawData.data.items;
      } else if (rawData.data.data && Array.isArray(rawData.data.data)) {
        messageList = rawData.data.data;
      }
    } else if (rawData.list && Array.isArray(rawData.list)) {
      messageList = rawData.list;
    }
    
    // Ensure we have an array
    if (!Array.isArray(messageList)) {
      console.warn('FetchGroupMessagesCommand: messageList is not an array:', messageList);
      messageList = [];
    }

    // Get AES key (first 16 characters of groupId)
    const aesKey = groupId.substring(0, 16);

    // Parse and decrypt each message
    const parsedMessages = [];
    for (const msg of messageList) {
      try {
        // Decrypt content
        let decryptedContent = msg.content || '';
        if (msg.content && typeof msg.content === 'string' && msg.content.length > 0) {
          try {
            decryptedContent = await this._decryptAES(msg.content, aesKey);
            // If decryption returned the same content, it might not be encrypted
            if (decryptedContent === msg.content && msg.content.length < 64) {
              // Short content might not be encrypted, use as is
              console.log('Content might not be encrypted, using as is:', msg.content.substring(0, 20));
            }
          } catch (e) {
            console.warn('Failed to decrypt message content:', e, 'Content length:', msg.content.length);
            decryptedContent = msg.content; // Fallback to original
          }
        }

        parsedMessages.push({
          id: msg.id || msg.pinId || msg.pin_id || msg.pin_id || `${groupId}_${msg.index || Date.now()}`,
          groupId: groupId,
          content: decryptedContent,
          timestamp: msg.timestamp || msg.time || (msg.createTime ? new Date(msg.createTime).getTime() / 1000 : Date.now() / 1000),
          userInfo: msg.userInfo || msg.user_info || msg.createUserInfo || null,
          index: msg.index !== undefined ? msg.index : null,
          _raw: msg,
        });
      } catch (error) {
        console.warn('Failed to parse message:', error, msg);
        // Still add message with minimal info
        parsedMessages.push({
          id: `${groupId}_${Date.now()}_${Math.random()}`,
          groupId: groupId,
          content: msg.content || '[Failed to parse]',
          timestamp: Date.now() / 1000,
          userInfo: null,
          index: null,
          _raw: msg,
        });
      }
    }

    return parsedMessages;
  }
}


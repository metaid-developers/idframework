/**
 * SelectConversationCommand
 * Handles selecting a conversation in the chat application
 * Follows IDFramework Command Pattern
 */

export default class SelectConversationCommand {
  /**
   * Generate mock messages for testing
   * @param {string} groupId - Group ID
   * @param {number} count - Number of messages to generate
   * @returns {Array} - Array of mock message objects
   */
  _generateMockMessages(groupId, count) {
    const mockMessages = [];
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    
    // Sample user names and avatars
    const sampleUsers = [
      { name: 'Alice', metaid: 'alice123', avatar: null },
      { name: 'Bob', metaid: 'bob456', avatar: null },
      { name: 'Charlie', metaid: 'charlie789', avatar: null },
      { name: 'Diana', metaid: 'diana012', avatar: null },
      { name: 'Eve', metaid: 'eve345', avatar: null },
      { name: 'Frank', metaid: 'frank678', avatar: null },
      { name: 'Grace', metaid: 'grace901', avatar: null },
      { name: 'Henry', metaid: 'henry234', avatar: null },
    ];
    
    // Sample message contents
    const sampleMessages = [
      'Hello everyone! 👋',
      'How is everyone doing today?',
      'This is a test message',
      '2026年MetalID必火 🔥🔥🔥',
      'Great to see you all here!',
      'Let\'s discuss the project',
      'I have an idea to share',
      'What do you think about this?',
      'Thanks for the update!',
      'Looking forward to the next meeting',
      'Can someone help me with this?',
      'I agree with that point',
      'Let me check and get back to you',
      'That sounds like a good plan',
      'We should schedule a call',
    ];
    
    for (let i = 0; i < count; i++) {
      const user = sampleUsers[Math.floor(Math.random() * sampleUsers.length)];
      const message = sampleMessages[Math.floor(Math.random() * sampleMessages.length)];
      
      // Generate timestamp (spread over last 7 days, newest first)
      const daysAgo = Math.random() * 7;
      const hoursAgo = Math.random() * 24;
      const timestamp = now - (daysAgo * 24 * 60 * 60) - (hoursAgo * 60 * 60);
      
      mockMessages.push({
        id: `${groupId}_mock_${i}`,
        groupId: groupId,
        content: message,
        timestamp: timestamp,
        userInfo: {
          metaid: user.metaid,
          name: user.name,
          avatarImage: user.avatar,
        },
        index: count - i - 1, // Reverse index (newest has highest index)
        _raw: { mock: true },
      });
    }
    
    // Sort by timestamp (oldest first)
    return mockMessages.sort((a, b) => a.timestamp - b.timestamp);
  }
  /**
   * @param {Object} context
   * @param {Object} context.payload - Event detail { metaid, groupId, type, index }
   * @param {Object} context.stores - Alpine stores object (wallet, chat, user, etc.)
   * @param {Object} context.delegate - IDFramework.Delegate
   */
  async execute({ payload, stores, delegate }) {
    try {
      const { metaid, groupId, type, index } = payload;
      
      // Get stores
      const chatStore = stores?.chat || (typeof Alpine !== 'undefined' ? Alpine.store('chat') : null);
      if (!chatStore) {
        console.warn('SelectConversationCommand: Chat store not available');
        return;
      }

      // Determine if this is a group chat (type=1) or private chat (type=2)
      const isGroupChat = String(type) === '1';
      const conversationKey = isGroupChat ? groupId : metaid;

      if (!conversationKey) {
        console.warn('SelectConversationCommand: No conversation key provided');
        return;
      }

      // Update current conversation
      chatStore.currentConversation = conversationKey;
      chatStore.currentConversationId = conversationKey; // For compatibility
      chatStore.currentConversationType = String(type || '2'); // Store type for later use (ensure it's a string)
      chatStore.currentConversationIndex = index; // Store index for fetching messages
      

      // Ensure conversation exists in conversations list
      if (!chatStore.conversations[conversationKey]) {
        chatStore.conversations[conversationKey] = {
          metaid: conversationKey,
          groupId: groupId || null,
          type: type || '2',
          index: index || null,
          lastMessage: null,
          lastMessageTime: null,
          unreadCount: 0,
        };
      }

      // Reset unread count for selected conversation
      chatStore.conversations[conversationKey].unreadCount = 0;

      // Ensure messages array exists for this conversation
      if (!chatStore.messages[conversationKey]) {
        chatStore.messages[conversationKey] = [];
      }

      // For group chats, fetch messages from API
      if (isGroupChat && groupId && index !== null && index !== undefined) {
        // Dispatch fetchGroupMessages command
        if (window.IDFramework) {
          window.IDFramework.dispatch('fetchGroupMessages', {
            groupId,
            startIndex: index,
            size: 50
          }).catch(err => {
            console.warn(`Failed to fetch group messages for ${groupId}:`, err);
          });
        }
      }

      // For private chats, fetch user info if not already loaded
      if (!isGroupChat && metaid) {
        const userStore = stores?.user || (typeof Alpine !== 'undefined' ? Alpine.store('user') : null);
        if (userStore && !userStore.users[metaid]) {
          // Dispatch fetchUser command
          if (window.IDFramework) {
            window.IDFramework.dispatch('fetchUser', { metaid }).catch(err => {
              console.warn(`Failed to fetch user info for ${metaid}:`, err);
            });
          }
        }
      }

      // Scroll to bottom of messages
      setTimeout(() => {
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 100);

    } catch (error) {
      console.error('SelectConversationCommand error:', error);
      const chatStore = stores?.chat || (typeof Alpine !== 'undefined' ? Alpine.store('chat') : null);
      if (chatStore) {
        chatStore.error = error.message || 'Failed to select conversation';
      }
    }
  }
}


import realtimeService from './realtimeService';

class TypingService {
  constructor() {
    this.typingUsers = new Map(); // chatId -> Set of user IDs
    this.typingTimeouts = new Map(); // userId -> timeout
    this.callbacks = new Map(); // chatId -> Set of callbacks
    this.userTypingState = new Map(); // chatId -> isTyping boolean
    
    this.TYPING_TIMEOUT = 3000; // 3 seconds
  }

  // Subscribe to typing indicators for a chat
  subscribeToTyping(chatId, currentUserId, callback) {
    console.log(`👀 Subscribing to typing indicators for chat ${chatId}`);

    // Store callback
    if (!this.callbacks.has(chatId)) {
      this.callbacks.set(chatId, new Set());
    }
    this.callbacks.get(chatId).add(callback);

    // Initialize typing users set
    if (!this.typingUsers.has(chatId)) {
      this.typingUsers.set(chatId, new Set());
    }

    // Subscribe to presence updates
    const channelKey = `typing_${chatId}`;
    realtimeService.subscribe(channelKey, {
      channelName: `typing:${chatId}`,
      presenceKey: currentUserId,
      presenceCallback: (presenceState, event, data) => {
        this.handlePresenceUpdate(chatId, currentUserId, presenceState, event, data);
      },
      broadcastCallback: (payload) => {
        this.handleTypingBroadcast(chatId, currentUserId, payload);
      }
    });

    // Return unsubscribe function
    return () => {
      this.unsubscribeFromTyping(chatId, callback);
    };
  }

  // Handle presence updates (users joining/leaving)
  handlePresenceUpdate(chatId, currentUserId, presenceState, event, data) {
    const activeUsers = new Set();
    
    // Extract active users from presence state
    Object.keys(presenceState).forEach(userId => {
      if (userId !== currentUserId && presenceState[userId].length > 0) {
        // Check if user is actively typing
        const userPresence = presenceState[userId][0];
        if (userPresence.typing) {
          activeUsers.add(userId);
        }
      }
    });

    // Update typing users
    this.typingUsers.set(chatId, activeUsers);
    
    // Filter out current user when notifying UI  
    const filteredActiveUsers = Array.from(activeUsers).filter(id => id !== currentUserId);
    this.notifyTypingChange(chatId, filteredActiveUsers);

    console.log(`👀 Presence update for chat ${chatId}:`, {
      event,
      activeTypingUsers: Array.from(activeUsers)
    });
  }

  // Handle typing broadcast messages  
  handleTypingBroadcast(chatId, currentUserId, payload) {
    const { event, userId, isTyping } = payload.payload;
    
    // Don't ignore own events - we might need them for debugging
    // But filter them out when notifying UI
    console.log(`⌨️ Typing broadcast for chat ${chatId}:`, { event, userId, isTyping, currentUserId });

    const typingUsers = this.typingUsers.get(chatId) || new Set();

    if (event === 'typing_start' && isTyping) {
      typingUsers.add(userId);
      
      // Clear existing timeout for this user
      if (this.typingTimeouts.has(`${chatId}_${userId}`)) {
        clearTimeout(this.typingTimeouts.get(`${chatId}_${userId}`));
      }
      
      // Set timeout to stop typing
      const timeoutKey = `${chatId}_${userId}`;
      const timeout = setTimeout(() => {
        this.handleTypingStop(chatId, userId);
      }, this.TYPING_TIMEOUT);
      
      this.typingTimeouts.set(timeoutKey, timeout);
      
    } else if (event === 'typing_stop' || !isTyping) {
      typingUsers.delete(userId);
      
      // Clear timeout
      const timeoutKey = `${chatId}_${userId}`;
      if (this.typingTimeouts.has(timeoutKey)) {
        clearTimeout(this.typingTimeouts.get(timeoutKey));
        this.typingTimeouts.delete(timeoutKey);
      }
    }

    this.typingUsers.set(chatId, typingUsers);
    
    // Filter out current user when notifying UI
    const filteredTypingUsers = Array.from(typingUsers).filter(id => id !== currentUserId);
    this.notifyTypingChange(chatId, filteredTypingUsers);
  }

  // Handle typing stop (from timeout)
  handleTypingStop(chatId, userId) {
    const typingUsers = this.typingUsers.get(chatId);
    if (typingUsers && typingUsers.has(userId)) {
      typingUsers.delete(userId);
      this.typingUsers.set(chatId, typingUsers);
      this.notifyTypingChange(chatId, Array.from(typingUsers));
      
      console.log(`⏰ Typing timeout for user ${userId} in chat ${chatId}`);
    }
  }

  // Start typing (called when user starts typing)
  async startTyping(chatId, userId) {
    const isCurrentlyTyping = this.userTypingState.get(chatId);
    if (isCurrentlyTyping) return; // Already typing

    this.userTypingState.set(chatId, true);

    console.log(`⌨️ User ${userId} started typing in chat ${chatId}`);

    try {
      // Update database typing indicator
      await this.updateTypingIndicator(chatId, userId, true);

      // Update presence
      const channelKey = `typing_${chatId}`;
      await realtimeService.sendPresence(channelKey, {
        typing: true,
        timestamp: Date.now()
      });

      // Send broadcast
      await realtimeService.sendBroadcast(channelKey, 'typing_start', {
        userId,
        isTyping: true
      });

    } catch (error) {
      console.error('Error starting typing indicator:', error);
    }
  }

  // Stop typing (called when user stops typing)
  async stopTyping(chatId, userId) {
    const isCurrentlyTyping = this.userTypingState.get(chatId);
    if (!isCurrentlyTyping) return; // Not typing

    this.userTypingState.set(chatId, false);

    console.log(`⏹️ User ${userId} stopped typing in chat ${chatId}`);

    try {
      // Update database typing indicator
      await this.updateTypingIndicator(chatId, userId, false);

      // Update presence
      const channelKey = `typing_${chatId}`;
      await realtimeService.sendPresence(channelKey, {
        typing: false,
        timestamp: Date.now()
      });

      // Send broadcast
      await realtimeService.sendBroadcast(channelKey, 'typing_stop', {
        userId,
        isTyping: false
      });

    } catch (error) {
      console.error('Error stopping typing indicator:', error);
    }
  }

  // Helper method to update typing indicator in database
  async updateTypingIndicator(chatId, userId, isTyping) {
    try {
      const { supabase } = await import('../../utils/supabase');
      const { error } = await supabase.rpc('set_typing_status', {
        p_chat_id: chatId,
        p_user_id: userId,
        p_is_typing: isTyping
      });

      if (error) {
        console.warn('Failed to update typing indicator in database:', error);
        // Don't throw - this is not critical, the broadcast will still work
      }
    } catch (error) {
      console.warn('Error updating typing indicator:', error);
    }
  }

  // Handle text input change (auto-manage typing state)
  handleTextChange(chatId, userId, text, previousText = '') {
    const wasTyping = previousText.length > 0;
    const isTyping = text.length > 0;

    if (!wasTyping && isTyping) {
      // Started typing
      this.startTyping(chatId, userId);
    } else if (wasTyping && !isTyping) {
      // Stopped typing
      this.stopTyping(chatId, userId);
    }
    // If still typing, the timeout will handle stopping
  }

  // Get typing users for a chat
  getTypingUsers(chatId) {
    return Array.from(this.typingUsers.get(chatId) || []);
  }

  // Generate typing indicator text
  getTypingIndicatorText(typingUsers, profilesMap = {}) {
    const count = typingUsers.length;
    
    if (count === 0) return '';
    
    if (count === 1) {
      const userId = typingUsers[0];
      const profile = profilesMap[userId];
      const name = profile?.display_name || profile?.username || 'Someone';
      return `${name} is typing...`;
    }
    
    if (count === 2) {
      const names = typingUsers.map(userId => {
        const profile = profilesMap[userId];
        return profile?.display_name || profile?.username || 'Someone';
      });
      return `${names.join(' and ')} are typing...`;
    }
    
    // 3+ users
    return `${count} people are typing...`;
  }

  // Notify callbacks about typing changes
  notifyTypingChange(chatId, typingUserIds) {
    const callbacks = this.callbacks.get(chatId);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(typingUserIds);
        } catch (error) {
          console.error('Error in typing callback:', error);
        }
      });
    }
  }

  // Unsubscribe from typing indicators
  unsubscribeFromTyping(chatId, callback) {
    // Remove callback
    const callbacks = this.callbacks.get(chatId);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.callbacks.delete(chatId);
      }
    }

    // Unsubscribe from realtime if no more callbacks
    if (!this.callbacks.has(chatId)) {
      const channelKey = `typing_${chatId}`;
      realtimeService.unsubscribe(channelKey);
      
      // Clean up local state
      this.typingUsers.delete(chatId);
      this.userTypingState.delete(chatId);
      
      console.log(`👋 Unsubscribed from typing indicators for chat ${chatId}`);
    }
  }

  // Cleanup all resources
  cleanup() {
    // Clear all timeouts
    for (const timeout of this.typingTimeouts.values()) {
      clearTimeout(timeout);
    }
    
    this.typingTimeouts.clear();
    this.typingUsers.clear();
    this.callbacks.clear();
    this.userTypingState.clear();
    
    console.log('🧹 Typing service cleaned up');
  }
}

// Create singleton instance
const typingService = new TypingService();

export default typingService;
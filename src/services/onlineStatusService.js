import { supabase } from '../../utils/supabase';
import { AppState } from 'react-native';

class OnlineStatusService {
  constructor() {
    this.currentUserId = null;
    this.heartbeatInterval = null;
    this.statusCallbacks = new Map();
    this.appStateSubscription = null;
    this.isInitialized = false;
    this.onlineChannel = null;
    this.userStatuses = new Map(); // Cache user statuses

    this.HEARTBEAT_INTERVAL = 60000; // 1 minute (for database backup)
    this.CLEANUP_INTERVAL = 300000; // 5 minutes
    this.BROADCAST_INTERVAL = 30000; // 30 seconds for real-time broadcasts
  }

  // Initialize the service
  async initialize(userId) {
    if (this.isInitialized && this.currentUserId === userId) {
      return; // Already initialized for this user
    }

    this.currentUserId = userId;
    this.isInitialized = true;

    console.log('🟢 Initializing online status service for user:', userId);

    // Set user as online in database
    await this.setOnlineStatus(true);

    // Setup real-time channel for online status broadcasts
    await this.setupOnlineStatusChannel();

    // Start heartbeat (backup for database)
    this.startHeartbeat();

    // Listen for app state changes
    this.setupAppStateListener();

    // Start periodic cleanup
    this.startPeriodicCleanup();

    // Broadcast online status immediately
    await this.broadcastOnlineStatus(true);
  }

  // Setup real-time channel for online status broadcasts
  async setupOnlineStatusChannel() {
    if (this.onlineChannel) {
      await this.onlineChannel.unsubscribe();
    }

    console.log('📡 Setting up online status real-time channel');

    this.onlineChannel = supabase
      .channel('online_status_global', {
        config: {
          broadcast: { self: false, ack: false },
          presence: { key: this.currentUserId },
        },
      })
      .on('broadcast', { event: 'user_status_change' }, (payload) => {
        this.handleStatusBroadcast(payload);
      })
      .subscribe((status) => {
        console.log('📡 Online status subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully connected to online status real-time');
        }
      });
  }

  // Handle incoming status broadcasts
  handleStatusBroadcast(payload) {
    const { userId, isOnline, lastSeen, displayStatus } = payload.payload;

    console.log('🔄 Received status broadcast:', {
      userId,
      isOnline,
      displayStatus
    });

    // Update cached status
    this.userStatuses.set(userId, {
      user_id: userId,
      is_online: isOnline,
      last_seen: lastSeen,
      display_status: displayStatus
    });

    // Notify all callbacks for this user
    const callbacks = this.statusCallbacks.get(userId);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback({
            user_id: userId,
            is_online: isOnline,
            last_seen: lastSeen,
            display_status: displayStatus
          });
        } catch (error) {
          console.error('Error in status callback:', error);
        }
      });
    }
  }

  // Broadcast online status change
  async broadcastOnlineStatus(isOnline) {
    if (!this.currentUserId || !this.onlineChannel) return;

    try {
      // Get privacy settings to determine what to broadcast
      const privacySettings = await this.getPrivacySettings();

      // If privacy is set to nobody, don't broadcast anything
      if (privacySettings?.online_status_privacy === 'nobody') {
        console.log('🔒 Privacy set to nobody - not broadcasting status');
        return;
      }

      const now = new Date();
      const statusData = {
        userId: this.currentUserId,
        isOnline,
        lastSeen: now.toISOString(),
        displayStatus: isOnline ? 'Online' : this.formatLastSeenTime(now),
        timestamp: Date.now(),
        privacyLevel: privacySettings?.online_status_privacy || 'everyone'
      };

      await this.onlineChannel.send({
        type: 'broadcast',
        event: 'user_status_change',
        payload: statusData,
      });

      console.log('📡 Broadcasted status change:', { isOnline, userId: this.currentUserId, privacy: statusData.privacyLevel });
    } catch (error) {
      console.error('Error broadcasting status:', error);
    }
  }

  // Format last seen time for display
  formatLastSeenTime(lastSeenDate) {
    const now = new Date();
    const diffInMinutes = Math.floor((now - lastSeenDate) / (1000 * 60));

    if (diffInMinutes < 5) {
      return 'Last seen recently';
    } else if (diffInMinutes < 60) {
      return `Last seen ${diffInMinutes} minutes ago`;
    } else if (diffInMinutes < 24 * 60) {
      const hours = Math.floor(diffInMinutes / 60);
      return `Last seen ${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInMinutes / (24 * 60));
      return `Last seen ${days} day${days > 1 ? 's' : ''} ago`;
    }
  }

  // Set user online/offline status
  async setOnlineStatus(isOnline = true) {
    if (!this.currentUserId) return;

    try {
      const { error } = await supabase.rpc('set_user_online_status', {
        p_user_id: this.currentUserId,
        p_is_online: isOnline
      });

      if (error) throw error;

      console.log(`🟢 User status updated in DB: ${isOnline ? 'Online' : 'Offline'}`);

      // Broadcast the status change immediately
      await this.broadcastOnlineStatus(isOnline);
    } catch (error) {
      console.error('Error updating online status:', error);
    }
  }

  // Update last seen (heartbeat)
  async updateLastSeen() {
    if (!this.currentUserId) return;

    try {
      const { error } = await supabase.rpc('update_last_seen', {
        p_user_id: this.currentUserId
      });

      if (error) throw error;

      // Also broadcast that we're still online
      await this.broadcastOnlineStatus(true);
    } catch (error) {
      console.error('Error updating last seen:', error);
    }
  }

  // Get user status with privacy applied
  async getUserStatus(userId) {
    if (!this.currentUserId) return null;

    // First check cache for instant response
    const cachedStatus = this.userStatuses.get(userId);
    if (cachedStatus) {
      return cachedStatus;
    }

    try {
      const { data, error } = await supabase.rpc('get_user_status', {
        p_user_id: userId,
        p_requesting_user_id: this.currentUserId
      });

      if (error) throw error;

      const status = data && data.length > 0 ? data[0] : null;

      // Cache the result
      if (status) {
        this.userStatuses.set(userId, status);
      }

      return status;
    } catch (error) {
      console.error('Error getting user status:', error);
      return null;
    }
  }

  // Start heartbeat to keep user online
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(async () => {
      await this.updateLastSeen();
    }, this.HEARTBEAT_INTERVAL);
  }

  // Stop heartbeat
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Setup app state listener
  setupAppStateListener() {
    this.appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        // App came to foreground
        console.log('🟢 App became active - setting user online');
        await this.setOnlineStatus(true);
        this.startHeartbeat();
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App went to background
        console.log('🔴 App went to background - setting user offline');
        await this.setOnlineStatus(false);
        this.stopHeartbeat();
      }
    });
  }

  // Start periodic cleanup of offline users
  startPeriodicCleanup() {
    setInterval(async () => {
      try {
        const { data: affectedCount } = await supabase.rpc('cleanup_offline_users');
        if (affectedCount && affectedCount > 0) {
          console.log(`🧹 Cleaned up ${affectedCount} offline users`);
        }
      } catch (error) {
        console.error('Error in periodic cleanup:', error);
      }
    }, this.CLEANUP_INTERVAL);
  }

  // Subscribe to status changes for a specific user
  subscribeToUserStatus(userId, callback) {
    if (!this.statusCallbacks.has(userId)) {
      this.statusCallbacks.set(userId, new Set());
    }
    this.statusCallbacks.get(userId).add(callback);

    // Get initial status
    this.getUserStatus(userId).then(status => {
      if (status) {
        callback(status);
      }
    });

    // Return unsubscribe function
    return () => {
      const callbacks = this.statusCallbacks.get(userId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.statusCallbacks.delete(userId);
        }
      }
    };
  }

  // Format status text for UI
  formatStatusText(status) {
    if (!status) return 'Unknown';

    if (status.is_online) {
      return 'Online';
    } else {
      return status.display_status || 'Offline';
    }
  }

  // Get status color for UI
  getStatusColor(status, theme) {
    if (!status) return theme.colors.textSecondary;

    return status.is_online ? '#00D4AA' : theme.colors.textSecondary;
  }

  // Update privacy settings
  async updatePrivacySettings(onlineStatusPrivacy, lastSeenPrivacy) {
    if (!this.currentUserId) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          online_status_privacy: onlineStatusPrivacy,
          last_seen_privacy: lastSeenPrivacy
        })
        .eq('id', this.currentUserId);

      if (error) throw error;

      console.log('✅ Privacy settings updated');
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      throw error;
    }
  }

  // Get current user's privacy settings
  async getPrivacySettings() {
    if (!this.currentUserId) return null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('online_status_privacy, last_seen_privacy')
        .eq('id', this.currentUserId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting privacy settings:', error);
      return null;
    }
  }

  // Cleanup
  async cleanup() {
    console.log('🧹 Cleaning up online status service');

    // Set user offline and broadcast it
    if (this.currentUserId) {
      await this.setOnlineStatus(false);
    }

    // Stop heartbeat
    this.stopHeartbeat();

    // Cleanup real-time channel
    if (this.onlineChannel) {
      await this.onlineChannel.unsubscribe();
      this.onlineChannel = null;
    }

    // Remove app state listener
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    // Clear callbacks and cache
    this.statusCallbacks.clear();
    this.userStatuses.clear();

    this.currentUserId = null;
    this.isInitialized = false;
  }
}

// Create singleton instance
const onlineStatusService = new OnlineStatusService();

export default onlineStatusService;
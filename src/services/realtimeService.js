import { supabase } from '../../utils/supabase';
import { AppState } from 'react-native';

class RealtimeService {
  constructor() {
    this.subscriptions = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.isOnline = true;
    this.messageQueue = [];
    
    this.setupAppStateHandling();
  }

  setupAppStateHandling() {
    AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        this.handleAppForeground();
      } else if (nextAppState === 'background') {
        this.handleAppBackground();
      }
    });
  }

  async handleAppForeground() {
    console.log('🔄 App came to foreground - reconnecting realtime...');
    this.isOnline = true;
    await this.reconnectAll();
    await this.processQueuedMessages();
  }

  handleAppBackground() {
    console.log('📱 App went to background');
    this.isOnline = false;
  }

  async reconnectAll() {
    for (const [key, subscription] of this.subscriptions) {
      console.log(`🔄 Reconnecting subscription: ${key}`);
      await this.resubscribe(key, subscription.config);
    }
  }

  async resubscribe(key, config) {
    // Unsubscribe existing
    if (this.subscriptions.has(key)) {
      await this.subscriptions.get(key).channel.unsubscribe();
    }

    // Create new subscription
    await this.subscribe(key, config);
  }

  async subscribe(key, config) {
    try {
      const {
        channelName,
        table,
        filter,
        event,
        callback,
        presenceCallback,
        broadcastCallback
      } = config;

      const channel = supabase.channel(channelName, {
        config: {
          broadcast: { self: true, ack: false },
          presence: { key: config.presenceKey || 'default' },
        },
      });

      // Add postgres changes listener if specified
      if (table && event && callback) {
        channel.on(
          'postgres_changes',
          { event, schema: 'public', table, filter },
          (payload) => {
            console.log(`📨 Real-time ${event} received for ${table}:`, payload.new);
            
            if (this.isOnline) {
              callback(payload);
            } else {
              // Queue message for when app comes back online
              this.messageQueue.push({ type: 'postgres', payload, callback });
            }
          }
        );
      }

      // Add presence listener if specified
      if (presenceCallback) {
        channel.on('presence', { event: 'sync' }, () => {
          const presenceState = channel.presenceState();
          presenceCallback(presenceState);
        });

        channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
          presenceCallback(channel.presenceState(), 'join', { key, newPresences });
        });

        channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          presenceCallback(channel.presenceState(), 'leave', { key, leftPresences });
        });
      }

      // Add broadcast listener if specified
      if (broadcastCallback) {
        // Listen to multiple broadcast events with detailed logging
        channel.on('broadcast', { event: 'message' }, (payload) => {
          console.log('📨 Received message broadcast:', payload);
          broadcastCallback(payload);
        });
        
        channel.on('broadcast', { event: 'instant_message' }, (payload) => {
          console.log('⚡ Received instant_message broadcast:', {
            event: payload.event,
            sender_id: payload.payload?.sender_id,
            temp_id: payload.payload?.temp_id,
            hasContent: !!payload.payload?.content_original
          });
          broadcastCallback(payload);
        });
        
        channel.on('broadcast', { event: 'typing_start' }, broadcastCallback);
        channel.on('broadcast', { event: 'typing_stop' }, broadcastCallback);
      }

      // Handle system events for better error recovery
      channel.on('system', {}, (payload) => {
        console.log('📡 Real-time system event:', payload);
        
        if (payload.status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time channel error:', payload);
          this.handleChannelError(key, config);
        }
      });

      // Subscribe with retry logic
      const subscriptionResult = await this.subscribeWithRetry(channel);
      
      if (subscriptionResult === 'SUBSCRIBED') {
        this.subscriptions.set(key, { channel, config });
        this.reconnectAttempts = 0; // Reset on successful connection
        console.log(`✅ Successfully subscribed to ${channelName}`);
        return channel;
      } else {
        throw new Error(`Failed to subscribe to ${channelName}`);
      }

    } catch (error) {
      console.error(`❌ Error subscribing to ${key}:`, error);
      this.handleChannelError(key, config);
    }
  }

  async subscribeWithRetry(channel) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Subscription timeout'));
      }, 10000); // 10 second timeout

      channel.subscribe((status) => {
        clearTimeout(timeoutId);
        resolve(status);
      });
    });
  }

  async handleChannelError(key, config) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
      
      console.log(`🔄 Attempting to reconnect ${key} in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(async () => {
        await this.resubscribe(key, config);
      }, delay);
    } else {
      console.error(`❌ Max reconnect attempts reached for ${key}`);
    }
  }

  async processQueuedMessages() {
    console.log(`📦 Processing ${this.messageQueue.length} queued messages`);
    
    while (this.messageQueue.length > 0) {
      const queuedMessage = this.messageQueue.shift();
      try {
        queuedMessage.callback(queuedMessage.payload);
      } catch (error) {
        console.error('Error processing queued message:', error);
      }
    }
  }

  unsubscribe(key) {
    if (this.subscriptions.has(key)) {
      const subscription = this.subscriptions.get(key);
      subscription.channel.unsubscribe();
      this.subscriptions.delete(key);
      console.log(`🔌 Unsubscribed from ${key}`);
    }
  }

  unsubscribeAll() {
    for (const [key] of this.subscriptions) {
      this.unsubscribe(key);
    }
    console.log('🔌 Unsubscribed from all channels');
  }

  // Send presence update (for typing indicators)
  async sendPresence(channelKey, data) {
    const subscription = this.subscriptions.get(channelKey);
    if (subscription) {
      await subscription.channel.track(data);
    }
  }

  // Send broadcast message (for typing events and instant messages)
  async sendBroadcast(channelKey, event, payload) {
    const subscription = this.subscriptions.get(channelKey);
    if (subscription) {
      await subscription.channel.send({
        type: 'broadcast',
        event,
        payload
      });
    }
  }

  // Send instant message via broadcast (like typing but for messages)
  async sendInstantMessage(channelKey, messageData) {
    console.log('📡 Sending instant message broadcast:', {
      channelKey,
      messageData: {
        temp_id: messageData.temp_id,
        sender_id: messageData.sender_id,
        content: messageData.content_original?.substring(0, 50) + '...'
      }
    });
    await this.sendBroadcast(channelKey, 'instant_message', messageData);
  }

  // Get connection status
  getConnectionStatus() {
    return this.isOnline && this.subscriptions.size > 0;
  }
}

// Create singleton instance
const realtimeService = new RealtimeService();

export default realtimeService;
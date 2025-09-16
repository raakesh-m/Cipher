import { supabase } from "../../utils/supabase";

export const MessageStatus = {
  SENDING: "sending",
  SENT: "sent",
  DELIVERED: "delivered",
  READ: "read",
  FAILED: "failed",
};

class MessageStatusService {
  constructor() {
    this.statusCallbacks = new Map();
    this.deliveryTimeouts = new Map();
  }

  // Send message with status tracking
  async sendMessage(
    chatId,
    content,
    senderId,
    recipientId,
    messageType = "text",
    tempId = null
  ) {
    const messageId = tempId || `temp_${Date.now()}_${Math.random()}`;

    try {
      // Create optimistic message locally first
      const optimisticMessage = {
        id: messageId,
        temp_id: messageId,
        chat_id: chatId,
        content_original: content,
        sender_id: senderId,
        message_type: messageType,
        status: MessageStatus.SENDING,
        created_at: new Date().toISOString(),
        is_temp: true,
      };

      // Notify callback about sending status
      this.notifyStatusChange(
        messageId,
        MessageStatus.SENDING,
        optimisticMessage
      );

      // Insert into database
      const { data: newMessage, error } = await supabase
        .from("messages")
        .insert({
          chat_id: chatId,
          content_original: content,
          sender_id: senderId,
          recipient_id: recipientId,
          message_type: messageType,
          status: MessageStatus.SENT,
          temp_id: messageId,
          created_at: new Date().toISOString(),
        })
        .select(
          `
          *,
          profiles!messages_sender_id_profiles_fkey (
            id,
            username,
            display_name,
            avatar_url
          )
        `
        )
        .single();

      if (error) {
        // Message failed to send
        this.notifyStatusChange(tempId, MessageStatus.FAILED, {
          ...optimisticMessage,
          error: error.message,
        });
        throw error;
      }

      // Message sent successfully - update local status
      this.notifyStatusChange(messageId, MessageStatus.SENT, {
        ...newMessage,
        temp_id: messageId,
      });

      // Set up delivery confirmation timeout
      this.setupDeliveryTimeout(newMessage.id);

      // Mark as delivered immediately if we know recipient is online
      setTimeout(async () => {
        await this.markAsDelivered(newMessage.id, recipientId);
      }, 100); // Small delay to simulate network latency

      return newMessage;
    } catch (error) {
      console.error("Error sending message:", error);
      this.notifyStatusChange(messageId, MessageStatus.FAILED, {
        error: error.message,
      });
      throw error;
    }
  }

  // Mark message as delivered
  async markAsDelivered(messageId, userId) {
    try {
      const { error } = await supabase
        .from("messages")
        .update({
          status: MessageStatus.DELIVERED,
          delivered_at: new Date().toISOString(),
        })
        .eq("id", messageId)
        .neq("sender_id", userId); // Don't mark own messages as delivered

      if (error) throw error;

      // Clear delivery timeout
      if (this.deliveryTimeouts.has(messageId)) {
        clearTimeout(this.deliveryTimeouts.get(messageId));
        this.deliveryTimeouts.delete(messageId);
      }

      console.log(`✅ Message ${messageId} marked as delivered`);
    } catch (error) {
      console.error("Error marking message as delivered:", error);
    }
  }

  // Mark message as read
  async markAsRead(messageId, userId, chatId = null, broadcastChannel = null) {
    try {
      const { data: updatedMessage, error } = await supabase
        .from("messages")
        .update({
          status: MessageStatus.READ,
          read_at: new Date().toISOString(),
        })
        .eq("id", messageId)
        .neq("sender_id", userId) // Don't mark own messages as read
        .select("*")
        .single();

      if (error) throw error;

      console.log(`✅ Message ${messageId} marked as read`);
      console.log(
        `📡 Broadcasting read status - Channel available: ${!!broadcastChannel}, Message chat: ${
          updatedMessage?.chat_id
        }`
      );

      // Broadcast instant read status update
      if (updatedMessage && updatedMessage.chat_id && broadcastChannel) {
        try {
          await broadcastChannel.send({
            type: "broadcast",
            event: "instant_read_status",
            payload: {
              message_id: messageId,
              status: MessageStatus.READ,
              read_at: updatedMessage.read_at,
              chat_id: updatedMessage.chat_id,
              reader_id: userId,
            },
          });
          console.log(`📡 Broadcasted read status for message ${messageId}`);
        } catch (broadcastError) {
          console.error("Error broadcasting read status:", broadcastError);
        }
      } else if (updatedMessage && updatedMessage.chat_id) {
        console.warn(
          `⚠️ No broadcast channel available for message ${messageId} read status`
        );
      }
    } catch (error) {
      console.error("Error marking message as read:", error);
    }
  }

  // Mark all messages in chat as read
  async markChatAsRead(chatId, userId, broadcastChannel = null) {
    try {
      console.log(
        `🔍 markChatAsRead called for chat ${chatId} by user ${userId}, broadcastChannel: ${!!broadcastChannel}`
      );

      // Get the messages that will be marked as read first for broadcasting
      const { data: messagesToRead, error: selectError } = await supabase
        .from("messages")
        .select("id, sender_id, temp_id")
        .eq("chat_id", chatId)
        .neq("sender_id", userId)
        .neq("status", "read"); // Check status instead of read_at

      if (selectError) throw selectError;

      console.log(
        `📋 Found ${
          messagesToRead?.length || 0
        } unread messages to mark as read:`,
        messagesToRead?.map((m) => ({ id: m.id, sender: m.sender_id }))
      );

      // Send individual read receipts BEFORE marking as read
      if (messagesToRead?.length > 0 && broadcastChannel) {
        const readTime = new Date().toISOString();

        try {
          // Send individual read receipts for each message (more reliable than bulk)
          for (const message of messagesToRead) {
            await broadcastChannel.send({
              type: "broadcast",
              event: "instant_read_receipt",
              payload: {
                temp_id: message.id, // Use the actual message ID
                read_at: readTime,
                read_by: userId,
              },
            });
            console.log(
              `📡 Sent read receipt for message ${message.id} to sender ${message.sender_id}`
            );
          }
          console.log(
            `📡 Broadcasted individual read receipts for ${messagesToRead.length} messages`
          );
        } catch (broadcastError) {
          console.error(
            "Error broadcasting individual read receipts:",
            broadcastError
          );
        }
      }

      // Now mark messages as read in database
      const { data, error } = await supabase.rpc("mark_chat_messages_read", {
        p_chat_id: chatId,
        p_user_id: userId,
      });

      if (error) throw error;

      const updatedCount = data || 0;
      console.log(
        `✅ ${updatedCount} messages in chat ${chatId} marked as read`
      );

      if (messagesToRead?.length > 0 && !broadcastChannel) {
        console.warn(
          `⚠️ No broadcast channel available for read receipts (${messagesToRead.length} messages)`
        );
      }

      // Also broadcast unread count change for chat list updates
      await supabase.channel("unread_count_changes").send({
        type: "broadcast",
        event: "unread_count_changed",
        payload: {
          chat_id: chatId,
          user_id: userId,
          action: "marked_read",
          count: updatedCount,
        },
      });
    } catch (error) {
      console.error("Error marking chat as read:", error);

      // Fallback to the old method
      try {
        const { error: fallbackError } = await supabase
          .from("messages")
          .update({
            status: MessageStatus.READ,
            read_at: new Date().toISOString(),
          })
          .eq("chat_id", chatId)
          .neq("sender_id", userId)
          .neq("status", MessageStatus.READ);

        if (fallbackError) throw fallbackError;
        console.log(
          `✅ Fallback: All messages in chat ${chatId} marked as read`
        );

        // Also broadcast for fallback
        await supabase.channel("unread_count_changes").send({
          type: "broadcast",
          event: "unread_count_changed",
          payload: {
            chat_id: chatId,
            user_id: userId,
            action: "marked_read_fallback",
          },
        });
      } catch (fallbackErr) {
        console.error("Fallback mark as read failed:", fallbackErr);
      }
    }
  }

  // Setup delivery timeout for failed delivery detection
  setupDeliveryTimeout(messageId) {
    const timeout = setTimeout(async () => {
      console.log(`⚠️ Message ${messageId} delivery timeout - checking status`);

      // Check if message is still in 'sent' status after timeout
      const { data: message } = await supabase
        .from("messages")
        .select("status")
        .eq("id", messageId)
        .single();

      if (message && message.status === MessageStatus.SENT) {
        // Still not delivered - could indicate recipient is offline
        console.log(
          `📤 Message ${messageId} not delivered yet (recipient offline?)`
        );
      }
    }, 30000); // 30 second timeout

    this.deliveryTimeouts.set(messageId, timeout);
  }

  // Subscribe to status changes for a specific message
  onStatusChange(messageId, callback) {
    if (!this.statusCallbacks.has(messageId)) {
      this.statusCallbacks.set(messageId, new Set());
    }
    this.statusCallbacks.get(messageId).add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.statusCallbacks.get(messageId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.statusCallbacks.delete(messageId);
        }
      }
    };
  }

  // Notify all callbacks about status change
  notifyStatusChange(messageId, status, messageData = {}) {
    const callbacks = this.statusCallbacks.get(messageId);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(status, { ...messageData, id: messageId });
        } catch (error) {
          console.error("Error in status callback:", error);
        }
      });
    }
  }

  // Get status icon for UI (like WhatsApp checkmarks)
  getStatusIcon(status) {
    switch (status) {
      case MessageStatus.SENDING:
        return "⏳"; // Clock icon
      case MessageStatus.SENT:
        return "✓"; // Single checkmark
      case MessageStatus.DELIVERED:
        return "✓✓"; // Double checkmark (gray)
      case MessageStatus.READ:
        return "✓✓"; // Double checkmark (blue/colored)
      case MessageStatus.FAILED:
        return "❌"; // Error icon
      default:
        return "";
    }
  }

  // Get status color for UI
  getStatusColor(status, theme) {
    switch (status) {
      case MessageStatus.SENDING:
        return theme.colors.textTertiary;
      case MessageStatus.SENT:
        return theme.colors.textSecondary;
      case MessageStatus.DELIVERED:
        return theme.colors.textSecondary;
      case MessageStatus.READ:
        return theme.colors.primary; // Blue like iMessage
      case MessageStatus.FAILED:
        return theme.colors.error;
      default:
        return theme.colors.textTertiary;
    }
  }

  // Cleanup
  cleanup() {
    // Clear all timeouts
    for (const timeout of this.deliveryTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.deliveryTimeouts.clear();
    this.statusCallbacks.clear();
  }
}

// Create singleton instance
const messageStatusService = new MessageStatusService();

export default messageStatusService;

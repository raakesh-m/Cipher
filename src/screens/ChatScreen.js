import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../utils/supabase";
import { translateMessageForRecipient } from "../utils/translation";
import { uploadToR2 } from "../utils/r2Storage";
import { useTheme } from "../contexts/ThemeContext";
import { sendPushNotification } from "../services/notificationService";

// New enhanced services
import messageStatusService, {
  MessageStatus,
} from "../services/messageStatusService";
import typingService from "../services/typingService";
import MessageBubble from "../components/MessageBubble";
import TypingIndicator from "../components/TypingIndicator";
import ConnectionStatus from "../components/ConnectionStatus";

export default function ChatScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { chatId, otherUser } = route.params;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const flatListRef = useRef(null);
  const previousInputText = useRef("");
  const typingTimeout = useRef(null);
  const previousTypingUsersLength = useRef(0);

  useEffect(() => {
    navigation.setOptions({
      title: otherUser?.display_name || otherUser?.username || "Chat",
    });

    // Start auth auto-refresh for React Native realtime reliability
    supabase.auth.startAutoRefresh();

    initializeChat();

    return () => {
      // Cleanup all services
      if (window.chatChannel) {
        window.chatChannel.unsubscribe();
        window.chatChannel = null;
      }
      supabase.auth.stopAutoRefresh();
      typingService.unsubscribeFromTyping(chatId, handleTypingUsersChange);
      messageStatusService.cleanup();
    };
  }, [chatId]);

  // Auto-scroll when typing users change
  useEffect(() => {
    if (typingUsers.length > 0) {
      // Small delay to ensure typing indicator is rendered before scrolling
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [typingUsers]);

  const initializeChat = async () => {
    await loadCurrentUser();
    await loadMessages();

    // Wait a moment for currentUser to be set
    const user = currentUser || (await getCurrentUserSync());

    // Create a single channel for both database changes and broadcasts
    const channel = supabase
      .channel(`chat_${chatId}`, {
        config: {
          broadcast: { self: false, ack: false },
          presence: { key: user?.id || "default" },
        },
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        handleNewMessage
      )
      .on("broadcast", { event: "instant_message" }, handleInstantMessage)
      .subscribe((status) => {
        console.log("📡 Subscription status:", status);
        if (status === "SUBSCRIBED") {
          console.log("✅ Successfully connected to realtime");
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ Channel subscription failed");
        }
      });

    // Store channel reference for cleanup
    window.chatChannel = channel;
  };

  const handleTypingUsersChange = (typingUserIds) => {
    setTypingUsers(typingUserIds);

    // Auto-scroll to show typing indicator when someone starts typing
    if (typingUserIds.length > previousTypingUsersLength.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }

    previousTypingUsersLength.current = typingUserIds.length;
  };

  // Helper to get current user synchronously
  const getCurrentUserSync = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      return { ...user, ...profile };
    }
    return null;
  };

  const loadCurrentUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      const currentUserProfile = { ...user, ...profile };
      setCurrentUser(currentUserProfile);

      // Build profiles map for typing indicators
      setProfilesMap((prev) => ({
        ...prev,
        [user.id]: profile,
        [otherUser?.user_id || otherUser?.id]: otherUser,
      }));

      // Subscribe to typing indicators after currentUser is set
      typingService.subscribeToTyping(chatId, user.id, handleTypingUsersChange);

      // Mark chat as read when entering
      await messageStatusService.markChatAsRead(chatId, user.id);
    }
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("messages")
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
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Process messages with status
      const processedMessages = (data || []).map((msg) => ({
        ...msg,
        status: msg.status || MessageStatus.SENT, // Default status
      }));

      setMessages(processedMessages);

      // Scroll to bottom after loading
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle instant messages (broadcast - immediate delivery like typing)
  const handleInstantMessage = (payload) => {
    console.log("🎯 handleInstantMessage called with payload:", {
      event: payload.event,
      hasPayload: !!payload.payload,
      payloadKeys: payload.payload ? Object.keys(payload.payload) : [],
    });

    const messageData = payload.payload;
    console.log("⚡ Instant message received:", {
      temp_id: messageData?.temp_id,
      sender_id: messageData?.sender_id,
      content: messageData?.content_original?.substring(0, 50) + "...",
      was_translated: messageData?.was_translated,
      chat_id: messageData?.chat_id,
    });

    // Skip own messages - they're already handled optimistically
    if (messageData?.sender_id === currentUser?.id) {
      console.log(
        "⚠️ Skipping own instant message (already shown optimistically):",
        messageData.temp_id
      );
      return;
    }

    console.log("✅ Processing incoming instant message from other user");

    // Add instant message to state immediately
    setMessages((prev) => {
      const messageExists = prev.some(
        (msg) =>
          msg.id === messageData.id || msg.temp_id === messageData.temp_id
      );
      if (messageExists) {
        console.log(
          "⚠️ Duplicate instant message detected, skipping:",
          messageData.temp_id
        );
        return prev;
      }

      console.log("⚡ Adding instant message:", messageData.temp_id);

      // Add with instant delivery status
      const instantMessage = {
        ...messageData,
        status: "delivered",
        is_instant: true,
        // content_original and content_translated are already correctly set from sender
      };

      return [...prev, instantMessage];
    });

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 50);
  };

  // Handle database messages (slower backup for reliability)
  const handleNewMessage = async (payload) => {
    const newMessage = payload.new || payload;
    console.log("🆕 Processing database message:", {
      id: newMessage.id,
      sender_id: newMessage.sender_id,
      content: newMessage.content_original?.substring(0, 50) + "...",
      was_translated: newMessage.was_translated,
    });

    // Skip own messages - they're already handled optimistically
    if (newMessage.sender_id === currentUser?.id) {
      console.log("⚠️ Skipping own database message:", newMessage.id);
      return;
    }

    // Check if instant message already exists - if so, update it with database ID
    setMessages((prev) => {
      // Look for matching instant message first
      const instantMessageIndex = prev.findIndex(
        (msg) => msg.temp_id === newMessage.temp_id && msg.is_instant
      );

      if (instantMessageIndex !== -1) {
        // Update instant message with database info
        console.log(
          "🔄 Updating instant message with database info:",
          newMessage.id
        );
        const updated = [...prev];
        updated[instantMessageIndex] = {
          ...updated[instantMessageIndex],
          ...newMessage,
          id: newMessage.id,
          is_instant: false,
          status: newMessage.status || "delivered",
        };
        return updated;
      }

      // Check if message already exists by ID
      const messageExists = prev.some((msg) => msg.id === newMessage.id);
      if (messageExists) {
        console.log(
          "⚠️ Duplicate database message detected, skipping:",
          newMessage.id
        );
        return prev;
      }

      // Add as new message if no instant version exists
      console.log("🆕 Adding new database message:", newMessage.id);

      const messageWithDefaults = {
        ...newMessage,
        status: newMessage.status || "delivered",
      };

      return [...prev, messageWithDefaults];
    });

    // Scroll to bottom only if this is a truly new message
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Note: Translation is now handled on the sender side before sending
  // This function is no longer used but kept for backwards compatibility
  const translateIncomingMessage = async (message) => {
    console.log(
      "ℹ️ translateIncomingMessage called but translation is now handled sender-side"
    );
    // Translation is now done by the sender before sending the message
    // No need to translate incoming messages anymore
    return;
  };

  const sendMessage = async () => {
    if (!inputText.trim() || sending) return;

    setSending(true);
    const messageText = inputText.trim();
    const recipientId = otherUser.id || otherUser.user_id;

    // Stop typing indicator
    if (currentUser?.id) {
      await typingService.stopTyping(chatId, currentUser.id);
    }

    // Clear input immediately for better UX
    setInputText("");
    previousInputText.current = "";

    try {
      // 🔄 STEP 1: Handle pre-translation if sender has API key
      let translationResult = {
        needsTranslation: false,
        originalText: messageText,
        translatedText: null,
        detectedLanguage: null,
        error: null,
      };

      // Get recipient profile first for translation
      const { data: recipientProfile } = await supabase
        .from("profiles")
        .select("known_languages, preferred_language")
        .eq("id", recipientId)
        .single();

      // Check if current user can translate (has API key)
      if (currentUser?.gemini_api_key_encrypted && recipientProfile) {
        console.log("🎯 Sender has API key - checking if translation needed");
        translationResult = await translateMessageForRecipient(
          messageText,
          currentUser.known_languages || ["English"],
          recipientProfile.known_languages || ["English"],
          recipientProfile.preferred_language || "English",
          currentUser.gemini_api_key_encrypted
        );
      }

      // Determine what content to send to recipient
      const contentForRecipient = translationResult.needsTranslation
        ? translationResult.translatedText
        : messageText;

      console.log("📤 Sending message:", {
        original: messageText,
        forRecipient: contentForRecipient,
        translated: translationResult.needsTranslation,
      });

      // 🚀 STEP 2: Add optimistic message (sender sees original)
      const tempId = `temp_${Date.now()}_${Math.random()}`;
      const optimisticMessage = {
        id: tempId,
        temp_id: tempId,
        chat_id: chatId,
        content_original: messageText, // Sender always sees original
        content_translated: translationResult.needsTranslation
          ? translationResult.translatedText
          : null,
        sender_id: currentUser.id,
        message_type: "text",
        status: "sending",
        created_at: new Date().toISOString(),
        profiles: currentUser,
        // Translation metadata (client-side only for now)
        was_translated: translationResult.needsTranslation,
        detected_language: translationResult.detectedLanguage,
        translation_error: translationResult.error,
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      // 🚀 STEP 3: INSTANT DELIVERY via broadcast
      const broadcastPayload = {
        ...optimisticMessage,
        // For recipient display:
        // If translated: original = sender's text, translated = translated text
        // If not translated: original = sender's text, translated = null
        content_original: messageText, // Always the sender's actual text
        content_translated: translationResult.needsTranslation
          ? translationResult.translatedText
          : null,
        sender_profile: currentUser,
      };

      if (window.chatChannel) {
        await window.chatChannel.send({
          type: "broadcast",
          event: "instant_message",
          payload: broadcastPayload,
        });
        console.log("✅ Broadcast sent successfully");
      }

      // Update local status to sent
      setMessages((prev) =>
        prev.map((msg) =>
          msg.temp_id === tempId ? { ...msg, status: "sent" } : msg
        )
      );

      // 💾 STEP 4: Save to database in background
      const databaseMessage = {
        chat_id: chatId,
        content_original: messageText, // Always store sender's original
        content_translated: translationResult.needsTranslation
          ? translationResult.translatedText
          : null,
        sender_id: currentUser.id,
        recipient_id: recipientId,
        message_type: "text",
        status: "sent",
        temp_id: tempId,
        was_translated: translationResult.needsTranslation,
        detected_language: translationResult.detectedLanguage,
        translation_source: "sender",
        created_at: new Date().toISOString(),
      };

      const { data: newMessage, error } = await supabase
        .from("messages")
        .insert(databaseMessage)
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

      if (error) throw error;

      // Update with database ID
      setMessages((prev) =>
        prev.map((msg) =>
          msg.temp_id === tempId
            ? { 
                ...newMessage, 
                profiles: currentUser, 
                status: "delivered",
                // Keep the temp_id for React key consistency
                temp_id: tempId
              }
            : msg
        )
      );

      // 🔔 Send push notification (use translated content if available)
      const { data: recipientProfileForNotification } = await supabase
        .from("profiles")
        .select("expo_push_token, display_name, username")
        .eq("id", recipientId)
        .single();

      if (recipientProfileForNotification?.expo_push_token) {
        try {
          const senderName =
            currentUser?.display_name || currentUser?.username || "Someone";
          await sendPushNotification(
            recipientProfileForNotification.expo_push_token,
            `Message from ${senderName}`,
            contentForRecipient, // Send translated version in notification
            {
              screen: "Chat",
              chatId: chatId,
              otherUser: {
                id: currentUser.id,
                user_id: currentUser.id,
                display_name: senderName,
                username: currentUser.username,
              },
            }
          );
        } catch (notificationError) {
          console.error(
            "❌ Failed to send push notification:",
            notificationError
          );
        }
      }

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);
    } catch (error) {
      console.error("❌ Failed to send message:", error);

      // Update message status to failed
      setMessages((prev) =>
        prev.map((msg) =>
          msg.temp_id && msg.status === "sending"
            ? { ...msg, status: "failed" }
            : msg
        )
      );

      Alert.alert("Error", "Failed to send message. Please try again.");
      setInputText(messageText); // Restore input text
    } finally {
      setSending(false);
    }
  };

  // This function is no longer needed as translation and notifications
  // are now handled directly in the sendMessage function
  const handleMessageTranslationAndNotification = async (
    messageData,
    messageText,
    recipientId
  ) => {
    console.log(
      "ℹ️ handleMessageTranslationAndNotification called but functionality moved to sendMessage"
    );
    // Translation and notifications are now handled in sendMessage function
    return;
  };

  // Handle text input changes for typing indicators
  const handleTextChange = (text) => {
    setInputText(text);

    if (currentUser?.id) {
      // Handle typing indicators
      typingService.handleTextChange(
        chatId,
        currentUser.id,
        text,
        previousInputText.current
      );
      previousInputText.current = text;
    }

    // Clear any existing typing timeout
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }

    // Set new timeout to stop typing after 3 seconds
    if (text.trim().length > 0) {
      typingTimeout.current = setTimeout(() => {
        if (currentUser?.id) {
          typingService.stopTyping(chatId, currentUser.id);
        }
      }, 3000);
    }
  };

  // Handle message retry (for failed messages)
  const handleRetryMessage = async (message) => {
    if (message.temp_id) {
      // Retry sending the message
      try {
        setSending(true);
        await messageStatusService.sendMessage(
          chatId,
          message.content,
          currentUser.id,
          otherUser.id || otherUser.user_id,
          message.message_type || "text",
          message.temp_id
        );

        // Remove failed message from list
        setMessages((prev) =>
          prev.filter((msg) => msg.temp_id !== message.temp_id)
        );
      } catch (error) {
        console.error("Retry failed:", error);
        Alert.alert("Error", "Failed to resend message");
      } finally {
        setSending(false);
      }
    }
  };

  const renderMessage = ({ item, index }) => {
    const isOwnMessage = item.sender_id === currentUser?.id;
    const showTimestamp =
      index === 0 ||
      (messages[index - 1] &&
        new Date(item.created_at).getDate() !==
          new Date(messages[index - 1].created_at).getDate());

    return (
      <MessageBubble
        message={item}
        isOwnMessage={isOwnMessage}
        onRetry={() => handleRetryMessage(item)}
        onLongPress={() => {
          // Add message actions (copy, delete, etc.)
          Alert.alert("Message Options", "What would you like to do?", [
            {
              text: "Copy",
              onPress: () => {
                // Copy to clipboard logic
              },
            },
            { text: "Cancel", style: "cancel" },
          ]);
        }}
        showTimestamp={showTimestamp}
      />
    );
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant camera roll permissions");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      await sendMediaMessage(result.assets[0]);
    }
  };

  const sendMediaMessage = async (asset) => {
    setSending(true);

    try {
      // Upload to R2
      const fileName = `${chatId}/${Date.now()}_${asset.fileName || "media"}`;
      const mediaUrl = await uploadToR2(asset.uri, fileName);

      // Insert message
      await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: currentUser.id,
        content_original: "",
        message_type: asset.type === "video" ? "video" : "image",
        media_url: mediaUrl,
        media_filename: asset.fileName,
        media_size: asset.fileSize,
      });
    } catch (error) {
      console.error("Error sending media:", error);
      Alert.alert("Error", "Failed to send media");
    } finally {
      setSending(false);
    }
  };

  const retryTranslation = async (messageId, originalContent) => {
    if (!currentUser?.gemini_api_key_encrypted) {
      Alert.alert("Error", "No translation API key configured");
      return;
    }

    try {
      const translatedContent = await translateMessage(
        originalContent,
        currentUser.preferred_language,
        currentUser.gemini_api_key_encrypted
      );

      await supabase
        .from("messages")
        .update({
          content_translated: translatedContent,
          translation_failed: false,
          translation_error: null,
        })
        .eq("id", messageId);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                content_translated: translatedContent,
                translation_failed: false,
              }
            : msg
        )
      );
    } catch (error) {
      Alert.alert("Translation Failed", error.message);
    }
  };

  if (loading) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text
              style={[
                styles.loadingText,
                { color: theme.colors.textSecondary },
              ]}
            >
              Loading messages...
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <SafeAreaView style={styles.safeArea}>
        <ConnectionStatus />
        <View style={styles.chatContainer}>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) =>
              item.id || item.temp_id || `msg_${Date.now()}`
            }
            contentContainerStyle={[
              styles.messagesList,
              { backgroundColor: theme.colors.background },
            ]}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            onLayout={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
            showsVerticalScrollIndicator={false}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
            }}
            ListFooterComponent={() => (
              <TypingIndicator
                key="typing-indicator"
                typingUsers={typingUsers}
                profilesMap={profilesMap}
              />
            )}
          />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.mediaButton,
              {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={pickImage}
          >
            <Ionicons
              name="image-outline"
              size={22}
              color={theme.colors.primary}
            />
          </TouchableOpacity>

          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: theme.colors.inputBackground,
                borderColor: theme.colors.inputBorder,
                color: theme.colors.text,
              },
            ]}
            value={inputText}
            onChangeText={handleTextChange}
            placeholder="Type a message..."
            placeholderTextColor={theme.colors.inputPlaceholder}
            multiline
            maxLength={1000}
            onFocus={() => {
              // Mark messages as read when user focuses input
              if (currentUser?.id) {
                messageStatusService.markChatAsRead(chatId, currentUser.id);
              }
              // Scroll to bottom when keyboard opens
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 300);
            }}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              {
                backgroundColor:
                  !inputText.trim() || sending
                    ? theme.colors.textTertiary
                    : theme.colors.primary,
              },
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size={16} color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "500",
  },
  keyboardView: {
    flex: 1,
  },
  messagesList: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  messageContainer: {
    maxWidth: "75%",
    marginVertical: 6,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "400",
  },
  timestamp: {
    fontSize: 12,
    marginTop: 6,
    fontWeight: "500",
  },
  translationError: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "500",
  },
  retryButton: {
    marginTop: 6,
  },
  retryText: {
    fontSize: 13,
    fontWeight: "600",
  },
  messageImage: {
    width: 220,
    height: 160,
    borderRadius: 14,
  },
  videoPlaceholder: {
    width: 220,
    height: 160,
    backgroundColor: "#000",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  videoText: {
    color: "#fff",
    marginTop: 8,
    fontSize: 16,
    fontWeight: "500",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  mediaButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    minHeight: 44,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
});

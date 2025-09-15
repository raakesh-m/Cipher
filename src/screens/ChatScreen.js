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
import onlineStatusService from "../services/onlineStatusService";
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
  const [otherUserStatus, setOtherUserStatus] = useState(null);
  const flatListRef = useRef(null);
  const previousInputText = useRef("");
  const typingTimeout = useRef(null);
  const previousTypingUsersLength = useRef(0);

  const getInitials = (name) => {
    if (!name) return "?";
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    return (
      words[0].charAt(0) + words[words.length - 1].charAt(0)
    ).toUpperCase();
  };

  useEffect(() => {
    navigation.setOptions({
      headerShown: false, // Hide the default header
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
      // Note: Don't cleanup onlineStatusService here as it's used app-wide
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
      .on(
        "broadcast",
        { event: "instant_message_update" },
        handleInstantMessageUpdate
      )
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

      // Initialize online status service
      await onlineStatusService.initialize(user.id);

      // Subscribe to other user's online status
      const otherUserId = otherUser?.id || otherUser?.user_id;
      if (otherUserId) {
        onlineStatusService.subscribeToUserStatus(otherUserId, (status) => {
          setOtherUserStatus(status);
        });
      }

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

  // Handle translation updates for instant messages
  const handleInstantMessageUpdate = (payload) => {
    console.log("🔄 handleInstantMessageUpdate called with payload:", {
      event: payload.event,
      hasPayload: !!payload.payload,
      temp_id: payload.payload?.temp_id,
      was_translated: payload.payload?.was_translated,
    });

    const messageData = payload.payload;

    // Skip own messages - translation updates are handled locally
    if (messageData?.sender_id === currentUser?.id) {
      console.log("⚠️ Skipping own translation update (handled locally)");
      return;
    }

    console.log("🔄 Processing translation update from other user");

    // Update existing message with translation data
    setMessages((prev) => {
      const messageIndex = prev.findIndex(
        (msg) => msg.temp_id === messageData.temp_id
      );

      if (messageIndex === -1) {
        console.log(
          "⚠️ No matching message found for translation update:",
          messageData.temp_id
        );
        return prev;
      }

      console.log("✅ Updating message with translation:", messageData.temp_id);
      const updated = [...prev];
      updated[messageIndex] = {
        ...updated[messageIndex],
        content_translated: messageData.content_translated,
        was_translated: messageData.was_translated,
        detected_language: messageData.detected_language,
      };
      return updated;
    });
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
          (msg.id && msg.id === messageData.id) ||
          (msg.temp_id && msg.temp_id === messageData.temp_id)
      );
      if (messageExists) {
        console.log(
          "⚠️ Duplicate instant message detected, skipping:",
          messageData.temp_id || messageData.id
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

    // For sender: check if we already have this message (by temp_id or id)
    if (newMessage.sender_id === currentUser?.id) {
      setMessages((prev) => {
        console.log("🗄️ Processing database message for sender:", {
          newMessageId: newMessage.id,
          newMessageTempId: newMessage.temp_id,
          totalExistingMessages: prev.length,
          existingTempIds: prev.map((m) => m.temp_id).filter(Boolean),
          existingIds: prev.map((m) => m.id).filter(Boolean),
          messageContent: newMessage.content_original?.substring(0, 20) + "...",
        });

        // First check for duplicate by database ID
        const duplicateByIdIndex = prev.findIndex(
          (msg) => msg.id === newMessage.id
        );
        if (duplicateByIdIndex !== -1) {
          console.log(
            "⚠️ Sender already has message with database ID:",
            newMessage.id,
            "- skipping"
          );
          return prev;
        }

        // Then check for optimistic message by temp_id to update
        const existingMessageIndex = prev.findIndex(
          (msg) => msg.temp_id === newMessage.temp_id
        );

        if (existingMessageIndex !== -1) {
          // Update existing optimistic message with database info
          console.log(
            "🔄 Updating sender's optimistic message with database info:",
            {
              index: existingMessageIndex,
              oldId: prev[existingMessageIndex].id,
              newId: newMessage.id,
              tempId: newMessage.temp_id,
            }
          );
          const updated = [...prev];
          updated[existingMessageIndex] = {
            ...updated[existingMessageIndex],
            ...newMessage,
            id: newMessage.id,
            status: newMessage.status || "delivered",
            // Remove temp_id once we have database ID to avoid key conflicts
            temp_id: undefined,
          };
          return updated;
        }

        console.log(
          "⚠️ No matching optimistic message found, ignoring database message for sender:",
          newMessage.id
        );
        // Don't add new database messages for sender - they should only have optimistic -> updated flow
        return prev;
      });
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
          // Remove temp_id once we have database ID to avoid key conflicts
          temp_id: undefined,
        };
        return updated;
      }

      // Check if message already exists by ID
      const messageExists = prev.some(
        (msg) =>
          (msg.id && msg.id === newMessage.id) ||
          (msg.temp_id && msg.temp_id === newMessage.temp_id)
      );
      if (messageExists) {
        console.log(
          "⚠️ Duplicate database message detected, skipping:",
          newMessage.id || newMessage.temp_id
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

  const sendMessage = async () => {
    console.log("🚀 sendMessage called with:", {
      inputText: inputText.trim(),
      sending,
      currentUser: currentUser?.id,
    });

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

    // 🚀 STEP 1: Add optimistic message immediately (sender sees original)
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const optimisticMessage = {
      id: tempId,
      temp_id: tempId,
      chat_id: chatId,
      content_original: messageText,
      content_translated: null, // Will be updated if translation completes
      sender_id: currentUser.id,
      message_type: "text",
      status: "sending",
      created_at: new Date().toISOString(),
      profiles: currentUser,
      was_translated: false, // Will be updated if translation completes
      detected_language: null,
      translation_error: null,
    };

    setMessages((prev) => {
      console.log("📱 Adding optimistic message:", {
        tempId,
        totalMessages: prev.length,
        existingTempIds: prev.map((m) => m.temp_id).filter(Boolean),
        existingIds: prev.map((m) => m.id).filter(Boolean),
      });

      // Double-check for duplicates before adding
      const duplicateIndex = prev.findIndex(
        (m) => (m.temp_id && m.temp_id === tempId) || (m.id && m.id === tempId)
      );
      if (duplicateIndex !== -1) {
        console.error(
          "🚨 DUPLICATE DETECTED in optimistic add:",
          tempId,
          "already exists at index",
          duplicateIndex
        );
        return prev; // Don't add duplicate
      }

      return [...prev, optimisticMessage];
    });

    // 🚀 STEP 2: INSTANT DELIVERY via broadcast (original message)
    const initialBroadcastPayload = {
      ...optimisticMessage,
      content_original: messageText,
      content_translated: null,
      sender_profile: currentUser,
    };

    try {
      if (window.chatChannel) {
        await window.chatChannel.send({
          type: "broadcast",
          event: "instant_message",
          payload: initialBroadcastPayload,
        });
        console.log("✅ Initial broadcast sent successfully");
      }

      // Update local status to sent immediately
      setMessages((prev) =>
        prev.map((msg) =>
          msg.temp_id === tempId ? { ...msg, status: "sent" } : msg
        )
      );

      // 🔄 STEP 3: Handle translation in background (non-blocking)
      let translationResult = {
        needsTranslation: false,
        originalText: messageText,
        translatedText: null,
        detectedLanguage: null,
        error: null,
      };

      // Get recipient profile for translation (in background)
      const { data: recipientProfile } = await supabase
        .from("profiles")
        .select("known_languages, preferred_language")
        .eq("id", recipientId)
        .single();

      // Check if current user can translate (has API key)
      if (currentUser?.gemini_api_key_encrypted && recipientProfile) {
        console.log("🎯 Sender has API key - checking if translation needed");
        try {
          translationResult = await translateMessageForRecipient(
            messageText,
            currentUser.known_languages || ["English"],
            recipientProfile.known_languages || ["English"],
            recipientProfile.preferred_language || "English",
            currentUser.gemini_api_key_encrypted
          );

          // Update optimistic message with translation result
          if (translationResult.needsTranslation) {
            console.log("🔄 Translation completed - updating message");
            setMessages((prev) =>
              prev.map((msg) =>
                msg.temp_id === tempId
                  ? {
                      ...msg,
                      content_translated: translationResult.translatedText,
                      was_translated: true,
                      detected_language: translationResult.detectedLanguage,
                    }
                  : msg
              )
            );

            // Send updated broadcast with translation
            const updatedBroadcastPayload = {
              ...initialBroadcastPayload,
              content_translated: translationResult.translatedText,
              was_translated: true,
              detected_language: translationResult.detectedLanguage,
            };

            if (window.chatChannel) {
              await window.chatChannel.send({
                type: "broadcast",
                event: "instant_message_update",
                payload: updatedBroadcastPayload,
              });
              console.log("✅ Translation broadcast sent successfully");
            }
          }
        } catch (translationError) {
          console.error("❌ Translation failed:", translationError);
          // Update message with translation error
          setMessages((prev) =>
            prev.map((msg) =>
              msg.temp_id === tempId
                ? {
                    ...msg,
                    translation_error: translationError.message,
                  }
                : msg
            )
          );
        }
      }

      // Determine content for database and notifications
      const contentForRecipient = translationResult.needsTranslation
        ? translationResult.translatedText
        : messageText;

      console.log("📤 Final message result:", {
        original: messageText,
        forRecipient: contentForRecipient,
        translated: translationResult.needsTranslation,
      });

      // 💾 STEP 4: Save to database in background
      const databaseMessage = {
        chat_id: chatId,
        content_original: messageText,
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

      console.log(
        "✅ Message saved to database:",
        newMessage.id,
        "- will update optimistic message via real-time"
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
      mediaTypes: "all",
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
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.colors.threadBackground },
      ]}
    >
      {/* Custom Curved Header */}
      <View style={[styles.curvedHeader, { backgroundColor: "#FFFFFF" }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color="#000000" />
          </TouchableOpacity>

          <View style={styles.headerUserInfo}>
            <Text style={[styles.headerName, { color: "#000000" }]}>
              {otherUser?.display_name || otherUser?.username || "Chat"}
            </Text>
            <Text style={[
              styles.headerStatus,
              { color: onlineStatusService.getStatusColor(otherUserStatus, theme) }
            ]}>
              {onlineStatusService.formatStatusText(otherUserStatus)}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[
                styles.circularActionButton,
                { backgroundColor: theme.colors.threadBackground },
              ]}
            >
              <Ionicons name="call" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.circularActionButton,
                { backgroundColor: theme.colors.threadBackground },
              ]}
            >
              <Ionicons name="videocam" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ConnectionStatus />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={styles.chatContainer}>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item, index) => {
              // Prioritize database ID over temp_id to avoid duplicates
              // If we have both temp_id and id, use id for uniqueness
              const key =
                item.id || item.temp_id || `msg_${index}_${Date.now()}`;
              return key;
            }}
            contentContainerStyle={styles.messagesList}
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
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: theme.colors.threadBackground,
            },
          ]}
        >
          <View style={styles.curvedInputWrapper}>
            <TouchableOpacity
              style={styles.micButton}
              onPress={() => {}} // Add microphone functionality here
            >
              <Ionicons name="mic" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <TextInput
              style={[
                styles.curvedTextInput,
                {
                  color: "#888888",
                },
              ]}
              value={inputText}
              onChangeText={handleTextChange}
              placeholder="Ok. Let me check"
              placeholderTextColor="#AAAAAA"
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

            <TouchableOpacity style={styles.attachButton} onPress={pickImage}>
              <Ionicons name="attach-outline" size={20} color="#CCCCCC" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.curvedSendButton,
                {
                  backgroundColor: theme.colors.threadBackground,
                },
              ]}
              onPress={sendMessage}
              disabled={!inputText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size={16} color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  curvedHeader: {
    paddingTop: Platform.OS === "ios" ? 0 : 10,
    paddingBottom: 0,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerUserInfo: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 20,
  },
  headerName: {
    fontSize: 18,
    fontWeight: "600",
  },
  headerStatus: {
    fontSize: 13,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    gap: 12,
  },
  circularActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  keyboardView: {
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
    paddingHorizontal: 20,
    flexGrow: 1,
    paddingBottom: 10,
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
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  curvedInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  micButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#999999",
    justifyContent: "center",
    alignItems: "center",
  },
  curvedTextInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    maxHeight: 100,
    minHeight: 36,
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  curvedSendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});

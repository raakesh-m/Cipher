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
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../utils/supabase";
import { translateMessage } from "../utils/translation";
import { uploadToR2, getR2Url } from "../utils/r2Storage";
import { useTheme } from "../contexts/ThemeContext";

export default function ChatScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { chatId, otherUser } = route.params;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const flatListRef = useRef(null);

  useEffect(() => {
    navigation.setOptions({
      title: otherUser?.display_name || otherUser?.username || "Chat",
    });

    loadCurrentUser();
    loadMessages();

    // Subscribe to new messages
    const subscription = supabase
      .channel(`messages:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const newMessage = payload.new;
          handleNewMessage(newMessage);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [chatId]);

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

      setCurrentUser({ ...user, ...profile });
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
            username,
            display_name,
            avatar_url
          )
        `
        )
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setMessages(data || []);
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewMessage = async (newMessage) => {
    // If it's not from the current user, try to translate it
    if (
      newMessage.sender_id !== currentUser?.id &&
      newMessage.message_type === "text"
    ) {
      await translateIncomingMessage(newMessage);
    } else {
      setMessages((prev) => [...prev, newMessage]);
    }

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const translateIncomingMessage = async (message) => {
    if (!currentUser?.gemini_api_key_encrypted || message.content_translated) {
      setMessages((prev) => [...prev, message]);
      return;
    }

    try {
      const translatedContent = await translateMessage(
        message.content_original,
        currentUser.preferred_language,
        currentUser.gemini_api_key_encrypted
      );

      // Update the message with translation
      const { error } = await supabase
        .from("messages")
        .update({
          content_translated: translatedContent,
          translation_failed: false,
          translation_error: null,
        })
        .eq("id", message.id);

      if (error) throw error;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === message.id
            ? { ...msg, content_translated: translatedContent }
            : msg
        )
      );
    } catch (error) {
      console.error("Translation failed:", error);

      // Update message with translation error
      await supabase
        .from("messages")
        .update({
          translation_failed: true,
          translation_error: error.message,
        })
        .eq("id", message.id);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === message.id
            ? {
                ...msg,
                translation_failed: true,
                translation_error: error.message,
              }
            : msg
        )
      );
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || sending) return;

    setSending(true);
    const messageText = inputText.trim();
    setInputText("");

    try {
      // First, insert the message in original language
      const { data: messageData, error: insertError } = await supabase
        .from("messages")
        .insert({
          chat_id: chatId,
          sender_id: currentUser.id,
          content_original: messageText,
          message_type: "text",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Then translate for the recipient if they have a translation key
      const { data: recipientProfile } = await supabase
        .from("profiles")
        .select("preferred_language, gemini_api_key_encrypted")
        .eq("id", otherUser.id || otherUser.user_id)
        .single();

      if (recipientProfile?.gemini_api_key_encrypted) {
        try {
          const translatedContent = await translateMessage(
            messageText,
            recipientProfile.preferred_language,
            recipientProfile.gemini_api_key_encrypted
          );

          await supabase
            .from("messages")
            .update({ content_translated: translatedContent })
            .eq("id", messageData.id);
        } catch (translationError) {
          console.error("Translation failed for recipient:", translationError);
          // Message still sent, just not translated
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message");
    } finally {
      setSending(false);
    }
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

  const renderMessage = ({ item }) => {
    const isFromMe = item.sender_id === currentUser?.id;
    const displayContent = isFromMe
      ? item.content_original
      : item.content_translated || item.content_original;

    return (
      <View
        style={[
          styles.messageContainer,
          isFromMe ? {
            alignSelf: "flex-end",
            backgroundColor: theme.colors.primary,
            ...theme.shadows.sm,
          } : {
            alignSelf: "flex-start",
            backgroundColor: theme.colors.card,
            borderWidth: 1,
            borderColor: theme.colors.border,
            ...theme.shadows.sm,
          },
        ]}
      >
        {item.message_type === "text" ? (
          <View>
            <Text
              style={[
                styles.messageText,
                {
                  color: isFromMe ? "#fff" : theme.colors.text,
                },
              ]}
            >
              {displayContent}
            </Text>
            {!isFromMe && item.translation_failed && (
              <View style={[
                styles.translationError,
                {
                  backgroundColor: theme.colors.error + '20',
                  borderColor: theme.colors.error + '40',
                }
              ]}>
                <Text style={[
                  styles.errorText,
                  { color: theme.colors.error }
                ]}>
                  Translation failed - API limit reached
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    retryTranslation(item.id, item.content_original)
                  }
                  style={styles.retryButton}
                >
                  <Text style={[
                    styles.retryText,
                    { color: theme.colors.primary }
                  ]}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate("MediaViewer", {
                mediaUrl: getR2Url(item.media_url),
                mediaType: item.message_type,
              })
            }
          >
            {item.message_type === "image" ? (
              <Image
                source={{ uri: getR2Url(item.media_url) }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.videoPlaceholder}>
                <Ionicons name="play-circle" size={48} color="#fff" />
                <Text style={styles.videoText}>Video</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        <Text
          style={[
            styles.timestamp,
            {
              color: isFromMe 
                ? "rgba(255,255,255,0.7)" 
                : theme.colors.textTertiary,
              textAlign: isFromMe ? "right" : "left",
            },
          ]}
        >
          {new Date(item.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[
        styles.container,
        { backgroundColor: theme.colors.background }
      ]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[
            styles.loadingText,
            { color: theme.colors.textSecondary }
          ]}>Loading messages...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: theme.colors.background }
    ]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.messagesList,
            { backgroundColor: theme.colors.background }
          ]}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          showsVerticalScrollIndicator={false}
        />

        <View style={[
          styles.inputContainer,
          {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
          },
        ]}>
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
            <Ionicons name="image-outline" size={22} color={theme.colors.primary} />
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
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor={theme.colors.inputPlaceholder}
            multiline
            maxLength={1000}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              {
                backgroundColor: (!inputText.trim() || sending) 
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
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

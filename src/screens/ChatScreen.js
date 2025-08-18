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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../utils/supabase";
import { translateMessage } from "../utils/translation";
import { uploadToR2, getR2Url } from "../utils/r2Storage";

export default function ChatScreen({ route, navigation }) {
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
          profiles!messages_sender_id_fkey (
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
        .eq("id", otherUser.id)
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
          isFromMe ? styles.myMessage : styles.otherMessage,
        ]}
      >
        {item.message_type === "text" ? (
          <View>
            <Text
              style={[
                styles.messageText,
                isFromMe ? styles.myMessageText : styles.otherMessageText,
              ]}
            >
              {displayContent}
            </Text>
            {!isFromMe && item.translation_failed && (
              <View style={styles.translationError}>
                <Text style={styles.errorText}>
                  Translation failed - API limit reached
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    retryTranslation(item.id, item.content_original)
                  }
                  style={styles.retryButton}
                >
                  <Text style={styles.retryText}>Retry</Text>
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
            isFromMe ? styles.myTimestamp : styles.otherTimestamp,
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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
            <Ionicons name="image" size={24} color="#007AFF" />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            multiline
            maxLength={1000}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  keyboardView: {
    flex: 1,
  },
  messagesList: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  messageContainer: {
    maxWidth: "80%",
    marginVertical: 4,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#007AFF",
  },
  otherMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e1e5e9",
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: "#fff",
  },
  otherMessageText: {
    color: "#1a1a1a",
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  myTimestamp: {
    color: "rgba(255,255,255,0.7)",
    textAlign: "right",
  },
  otherTimestamp: {
    color: "#999",
  },
  translationError: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "rgba(255,59,48,0.1)",
    borderRadius: 8,
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 12,
  },
  retryButton: {
    marginTop: 4,
  },
  retryText: {
    color: "#007AFF",
    fontSize: 12,
    fontWeight: "600",
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
  },
  videoPlaceholder: {
    width: 200,
    height: 150,
    backgroundColor: "#000",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  videoText: {
    color: "#fff",
    marginTop: 8,
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e1e5e9",
  },
  mediaButton: {
    padding: 8,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e1e5e9",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: "#007AFF",
    borderRadius: 20,
    padding: 8,
    marginLeft: 8,
    justifyContent: "center",
    alignItems: "center",
    width: 36,
    height: 36,
  },
  sendButtonDisabled: {
    backgroundColor: "#ccc",
  },
});

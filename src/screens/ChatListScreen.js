import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../utils/supabase";
import { useTheme } from "../contexts/ThemeContext";

export default function ChatListScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadChats();

    // Subscribe to new messages for real-time updates
    const subscription = supabase
      .channel("messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          loadChats();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadChats = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get chats with latest message and other participant info
      const { data, error } = await supabase
        .from("chats")
        .select(
          `
          id,
          created_at,
          chat_participants!inner (
            user_id,
            profiles!inner (
              id,
              username,
              display_name,
              avatar_url
            )
          ),
          messages (
            content_translated,
            content_original,
            message_type,
            created_at,
            sender_id
          )
        `
        )
        .order("updated_at", { ascending: false });

      if (error) throw error;

      // Process chats to get the other participant and latest message
      const processedChats = data.map((chat) => {
        const otherParticipant = chat.chat_participants.find(
          (p) => p.user_id !== user.id
        );

        const latestMessage = chat.messages.sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        )[0];

        return {
          id: chat.id,
          otherUser: {
            ...otherParticipant?.profiles,
            user_id: otherParticipant?.user_id,
          },
          latestMessage,
          updatedAt: chat.created_at,
        };
      });

      setChats(processedChats);
    } catch (error) {
      console.error("Error loading chats:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadChats();
  };

  const handleSignOut = async () => {
    // Clear the keep signed in preference so user stays logged out
    await AsyncStorage.setItem("keepSignedIn", "false");
    await supabase.auth.signOut();
  };

  const formatMessagePreview = (message) => {
    if (!message) return "No messages yet";

    if (message.message_type === "text") {
      return message.content_translated || message.content_original;
    } else {
      return `📎 ${message.message_type}`;
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";

    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      return date.toLocaleDateString();
    }
  };

  const renderChatItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.chatItem,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          ...theme.shadows.sm,
        },
      ]}
      onPress={() =>
        navigation.navigate("Chat", {
          chatId: item.id,
          otherUser: item.otherUser,
        })
      }
    >
      <View style={[
        styles.avatar,
        { backgroundColor: theme.colors.primary }
      ]}>
        <Text style={styles.avatarText}>
          {item.otherUser?.display_name?.charAt(0).toUpperCase() || "?"}
        </Text>
      </View>

      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={[
            styles.chatName,
            { color: theme.colors.text }
          ]}>
            {item.otherUser?.display_name ||
              item.otherUser?.username ||
              "Unknown User"}
          </Text>
          <Text style={[
            styles.chatTime,
            { color: theme.colors.textTertiary }
          ]}>
            {formatTime(item.latestMessage?.created_at)}
          </Text>
        </View>

        <Text 
          style={[
            styles.chatPreview,
            { color: theme.colors.textSecondary }
          ]} 
          numberOfLines={1}
        >
          {formatMessagePreview(item.latestMessage)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[
        styles.container,
        { backgroundColor: theme.colors.background }
      ]}>
        <View style={[
          styles.header,
          {
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.border,
          },
        ]}>
          <Text style={[
            styles.title,
            { color: theme.colors.text }
          ]}>Chats</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[
            styles.loadingText,
            { color: theme.colors.textSecondary }
          ]}>Loading chats...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: theme.colors.background }
    ]}>
      <View style={[
        styles.header,
        {
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.border,
          ...theme.shadows.sm,
        },
      ]}>
        <Text style={[
          styles.title,
          { color: theme.colors.text }
        ]}>Chats</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[
              styles.headerButton,
              {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={() => navigation.navigate("UserSearch")}
          >
            <Ionicons name="add" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.headerButton,
              {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={() => navigation.navigate("Settings")}
          >
            <Ionicons name="settings-outline" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.headerButton,
              {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
              },
            ]} 
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      {chats.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[
            styles.emptyIcon,
            { backgroundColor: theme.colors.surface }
          ]}>
            <Ionicons 
              name="chatbubbles-outline" 
              size={48} 
              color={theme.colors.textTertiary} 
            />
          </View>
          <Text style={[
            styles.emptyText,
            { color: theme.colors.text }
          ]}>No conversations yet</Text>
          <Text style={[
            styles.emptySubtext,
            { color: theme.colors.textSecondary }
          ]}>
            Start chatting with friends by tapping the + button above
          </Text>
          <TouchableOpacity
            style={[
              styles.startChatButton,
              { backgroundColor: theme.colors.primary }
            ]}
            onPress={() => navigation.navigate("UserSearch")}
          >
            <Ionicons name="add" size={20} color="#fff" style={{ marginRight: theme.spacing.sm }} />
            <Text style={styles.startChatText}>Start New Chat</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={chats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          contentContainerStyle={[
            styles.chatList,
            { backgroundColor: theme.colors.background }
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  headerButtons: {
    flexDirection: "row",
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
  startChatButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 8,
  },
  startChatText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  chatList: {
    paddingVertical: 12,
  },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  avatarText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  chatName: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  chatTime: {
    fontSize: 13,
    fontWeight: "500",
  },
  chatPreview: {
    fontSize: 15,
    lineHeight: 20,
  },
});

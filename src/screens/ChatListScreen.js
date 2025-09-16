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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../utils/supabase";
import { useTheme } from "../contexts/ThemeContext";
import onlineStatusService from "../services/onlineStatusService";

export default function ChatListScreen({ navigation }) {
  const { theme } = useTheme();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [currentUser, setCurrentUser] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});

  useEffect(() => {
    loadCurrentUser();
    loadChats();

    // Add navigation focus listener to refresh unread counts when returning to chat list
    const unsubscribeFocus = navigation?.addListener ? navigation.addListener('focus', () => {
      console.log("📱 Chat list focused - refreshing unread counts");
      loadUnreadCounts();
      loadChats(); // Also refresh chats to show latest messages
    }) : null;

    // Subscribe to new messages for real-time updates
    const messagesSubscription = supabase
      .channel("messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          console.log("📨 Message change detected:", payload.eventType);
          loadChats();
          loadUnreadCounts();
        }
      )
      .subscribe();

    // Subscribe to unread count changes
    const unreadCountSubscription = supabase
      .channel("unread_count_changes")
      .on("broadcast", { event: "unread_count_changed" }, (payload) => {
        console.log("🔢 Unread count changed:", payload);
        // Refresh unread counts immediately
        loadUnreadCounts();
      })
      .subscribe();

    // Subscribe to typing indicators
    const typingSubscription = supabase
      .channel("typing_global")
      .on("broadcast", { event: "typing" }, (payload) => {
        const { chatId, userId, isTyping } = payload.payload;
        if (userId !== currentUser?.id) {
          setTypingUsers(prev => ({
            ...prev,
            [chatId]: isTyping ? userId : null
          }));
        }
      })
      .subscribe();

    return () => {
      messagesSubscription.unsubscribe();
      unreadCountSubscription.unsubscribe();
      typingSubscription.unsubscribe();
      if (unsubscribeFocus) unsubscribeFocus();
    };
  }, [currentUser?.id]);

  const loadCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        setCurrentUser(profile);

        // Initialize online status service globally
        await onlineStatusService.initialize(user.id);

        loadUnreadCounts();
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const loadUnreadCounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use the new database function for better performance
      const { data: unreadData, error } = await supabase.rpc('get_unread_counts', {
        p_user_id: user.id
      });

      if (error) throw error;

      // Convert to object format
      const unreadCountsMap = {};
      unreadData?.forEach(row => {
        unreadCountsMap[row.chat_id] = row.unread_count;
      });

      setUnreadCounts(unreadCountsMap);
    } catch (error) {
      console.error('Error loading unread counts:', error);
      // Fallback to the old method if the function doesn't exist yet
      try {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('messages')
          .select('chat_id, id')
          .neq('sender_id', user.id)
          .is('read_at', null);

        if (fallbackError) throw fallbackError;

        const unreadCountsMap = {};
        fallbackData?.forEach(message => {
          unreadCountsMap[message.chat_id] = (unreadCountsMap[message.chat_id] || 0) + 1;
        });

        setUnreadCounts(unreadCountsMap);
      } catch (fallbackErr) {
        console.error('Fallback unread count loading failed:', fallbackErr);
      }
    }
  };

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
    loadUnreadCounts();
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

  const getInitials = (name) => {
    if (!name) return "?";
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };

  const tabs = [
    { id: 'all', label: 'All Chats' },
    { id: 'groups', label: 'Groups' }
  ];

  const renderTabItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.tabItem,
        activeTab === item.id && [styles.activeTabItem, { backgroundColor: theme.colors.primary }]
      ]}
      onPress={() => setActiveTab(item.id)}
    >
      <Text style={[
        styles.tabText,
        { color: activeTab === item.id ? '#FFFFFF' : theme.colors.textSecondary },
        activeTab === item.id && styles.activeTabText
      ]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  const renderChatItem = ({ item }) => {
    // Get live data instead of hardcoded values
    const unreadCount = unreadCounts[item.id] || 0;
    const isPinned = false; // TODO: Implement pinned chats feature
    const isTyping = !!typingUsers[item.id];

    return (
      <TouchableOpacity
        style={[
          styles.chatItem,
          { borderBottomColor: theme.colors.divider }
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
            {getInitials(item.otherUser?.display_name || item.otherUser?.username)}
          </Text>
        </View>

        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <View style={styles.nameRow}>
              <Text style={[
                styles.chatName,
                { color: theme.colors.textPrimary }
              ]}>
                {item.otherUser?.display_name ||
                  item.otherUser?.username ||
                  "Unknown User"}
              </Text>
              {isPinned && (
                <Ionicons
                  name="pin"
                  size={14}
                  color={theme.colors.primary}
                  style={styles.pinIcon}
                />
              )}
            </View>
            <View style={styles.timeRow}>
              {unreadCount > 0 && (
                <View style={[styles.unreadBadge, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.unreadText}>{unreadCount}</Text>
                </View>
              )}
              <Text style={[
                styles.chatTime,
                { color: theme.colors.textSecondary }
              ]}>
                {formatTime(item.latestMessage?.created_at)}
              </Text>
            </View>
          </View>

          <Text
            style={[
              styles.chatPreview,
              { color: isTyping ? theme.colors.primary : theme.colors.textSecondary },
              isTyping && styles.typingText
            ]}
            numberOfLines={1}
          >
            {isTyping ? "Typing..." : formatMessagePreview(item.latestMessage)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[
        styles.container,
        { backgroundColor: theme.colors.background }
      ]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardView}
        >
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
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: theme.colors.background }
    ]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <View style={[
          styles.header,
          {
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.divider,
          },
        ]}>
          <View style={styles.headerContent}>
            <View style={styles.greetingSection}>
              <Text style={[
                styles.greeting,
                { color: theme.colors.textPrimary }
              ]}>
                Hello,
              </Text>
              <Text style={[
                styles.userName,
                { color: theme.colors.textPrimary }
              ]}>
                {(currentUser?.display_name || currentUser?.username || 'User').split(' ')[0]}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerActionButton}
                onPress={() => navigation.navigate("UserSearch")}
              >
                <Ionicons name="search" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerActionButton}
                onPress={() => navigation.navigate("Profile")}
              >
                <Ionicons name="ellipsis-vertical" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={[
          styles.tabContainer,
          { backgroundColor: theme.colors.surface }
        ]}>
          <FlatList
            data={tabs}
            renderItem={renderTabItem}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabContent}
          />
        </View>

        {activeTab === 'groups' ? (
          <View style={styles.emptyState}>
            <View style={[
              styles.emptyIcon,
              { backgroundColor: theme.colors.surface }
            ]}>
              <Ionicons
                name="people-outline"
                size={48}
                color={theme.colors.textTertiary}
              />
            </View>
            <Text style={[
              styles.emptyText,
              { color: theme.colors.text }
            ]}>Groups Coming Soon</Text>
            <Text style={[
              styles.emptySubtext,
              { color: theme.colors.textSecondary }
            ]}>
              Group chats feature is currently under development and will be available soon!
            </Text>
          </View>
        ) : chats.length === 0 ? (
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
            data={activeTab === 'all' ? chats : []}
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
            contentContainerStyle={styles.chatList}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* FAB */}
        <TouchableOpacity
          style={[
            styles.fab,
            { backgroundColor: theme.colors.primary }
          ]}
          onPress={onRefresh}
        >
          <Ionicons name="refresh" size={24} color={theme.colors.badgeText} />
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
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
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greetingSection: {
    flexDirection: "column",
  },
  greeting: {
    fontSize: 16,
    fontWeight: "400",
    color: "#666",
    marginBottom: 2,
  },
  userName: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: "row",
    gap: 16,
  },
  headerActionButton: {
    padding: 8,
  },
  tabContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  tabContent: {
    gap: 12,
  },
  tabItem: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  activeTabItem: {
    borderRadius: 20,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
  },
  activeTabText: {
    fontWeight: "600",
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
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
    paddingHorizontal: 24,
  },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 0,
    minHeight: 76,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chatName: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  pinIcon: {
    marginLeft: 6,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  unreadText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  chatTime: {
    fontSize: 13,
    fontWeight: "500",
  },
  chatPreview: {
    fontSize: 15,
    lineHeight: 20,
  },
  typingText: {
    fontStyle: "italic",
  },
});

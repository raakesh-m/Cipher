import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../utils/supabase";
import { useTheme } from "../contexts/ThemeContext";

export default function UserSearchScreen({ navigation }) {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [searchTimeout, setSearchTimeout] = useState(null);

  useEffect(() => {
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .or(
          `username.ilike.%${query}%,display_name.ilike.%${query}%`
        )
        .neq("id", currentUserId)
        .limit(20);

      if (error) throw error;

      setSearchResults(data || []);
    } catch (error) {
      console.error("Error searching users:", error);
      Alert.alert("Error", "Failed to search users");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text) => {
    setSearchQuery(text);

    // Debounce search
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      searchUsers(text);
    }, 300);
    
    setSearchTimeout(timeout);
  };

  const startChat = async (otherUser) => {
    try {
      // Use the database function to find or create chat
      const { data, error } = await supabase.rpc("find_or_create_chat", {
        other_user_id: otherUser.id,
      });

      if (error) throw error;

      const chatId = data;

      // Navigate to the chat
      navigation.navigate("Chat", {
        chatId,
        otherUser,
      });
    } catch (error) {
      console.error("Error creating chat:", error);
      Alert.alert("Error", "Failed to start chat");
    }
  };

  const renderUserItem = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.userItem,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          ...theme.shadows.sm,
        },
      ]} 
      onPress={() => startChat(item)}
    >
      <View style={[
        styles.avatar,
        { backgroundColor: theme.colors.primary }
      ]}>
        <Text style={styles.avatarText}>
          {item.display_name?.charAt(0).toUpperCase() ||
            item.username?.charAt(0).toUpperCase() ||
            "?"}
        </Text>
      </View>

      <View style={styles.userInfo}>
        <Text style={[
          styles.displayName,
          { color: theme.colors.text }
        ]}>
          {item.display_name || item.username}
        </Text>
        <Text style={[
          styles.username,
          { color: theme.colors.textSecondary }
        ]}>@{item.username}</Text>
      </View>

      <View style={[
        styles.chatButton,
        { backgroundColor: theme.colors.primary + '20' }
      ]}>
        <Ionicons name="chatbubble" size={16} color={theme.colors.primary} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: theme.colors.background }
    ]}>
      <View style={[
        styles.searchContainer,
        {
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.border,
          ...theme.shadows.sm,
        },
      ]}>
        <View style={[
          styles.searchInputContainer,
          {
            backgroundColor: theme.colors.inputBackground,
            borderColor: theme.colors.inputBorder,
          },
        ]}>
          <Ionicons
            name="search"
            size={20}
            color={theme.colors.textTertiary}
            style={styles.searchIcon}
          />
          <TextInput
            style={[
              styles.searchInput,
              { color: theme.colors.text }
            ]}
            placeholder="Search by username or display name..."
            placeholderTextColor={theme.colors.inputPlaceholder}
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => handleSearch('')}
              style={styles.clearButton}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={theme.colors.textTertiary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {searchQuery.length === 0 ? (
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
          ]}>Find new friends</Text>
          <Text style={[
            styles.emptySubtext,
            { color: theme.colors.textSecondary }
          ]}>
            Search by username or display name to start conversations with people around the world
          </Text>
        </View>
      ) : loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[
            styles.emptyText,
            { color: theme.colors.textSecondary, marginTop: 16 }
          ]}>Searching...</Text>
        </View>
      ) : searchResults.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[
            styles.emptyIcon,
            { backgroundColor: theme.colors.surface }
          ]}>
            <Ionicons 
              name="person-outline" 
              size={48} 
              color={theme.colors.textTertiary} 
            />
          </View>
          <Text style={[
            styles.emptyText,
            { color: theme.colors.text }
          ]}>No users found</Text>
          <Text style={[
            styles.emptySubtext,
            { color: theme.colors.textSecondary }
          ]}>
            Try searching with a different username or display name
          </Text>
        </View>
      ) : (
        <FlatList
          data={searchResults}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.resultsList,
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
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    minHeight: 48,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: "500",
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
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
  resultsList: {
    paddingVertical: 12,
  },
  userItem: {
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
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  username: {
    fontSize: 15,
    fontWeight: "500",
  },
  chatButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
});

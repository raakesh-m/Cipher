import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../utils/supabase";
import { useTheme } from "../contexts/ThemeContext";

export default function CreateGroupScreen({ navigation }) {
  const { theme } = useTheme();
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadCurrentUser();
    searchUsers();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

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
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const searchUsers = async (query = "") => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let queryBuilder = supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .neq("id", user.id);

      if (query.trim()) {
        queryBuilder = queryBuilder.or(
          `username.ilike.%${query}%,display_name.ilike.%${query}%`
        );
      }

      const { data, error } = await queryBuilder.limit(50);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error searching users:", error);
    }
  };

  const toggleUserSelection = (user) => {
    setSelectedUsers(prev => {
      const isSelected = prev.find(u => u.id === user.id);
      if (isSelected) {
        return prev.filter(u => u.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  };

  const createGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert("Error", "Please enter a group name");
      return;
    }

    if (selectedUsers.length === 0) {
      Alert.alert("Error", "Please select at least one participant");
      return;
    }

    setLoading(true);
    try {
      const participantIds = selectedUsers.map(user => user.id);

      const { data, error } = await supabase.rpc('create_group_chat', {
        p_creator_id: currentUser.id,
        p_chat_name: groupName.trim(),
        p_chat_description: groupDescription.trim() || null,
        p_participant_ids: participantIds
      });

      if (error) throw error;

      Alert.alert(
        "Success",
        "Group chat created successfully!",
        [
          {
            text: "OK",
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (error) {
      console.error("Error creating group:", error);
      Alert.alert("Error", "Failed to create group chat. Please try again.");
    } finally {
      setLoading(false);
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

  const renderUserItem = ({ item }) => {
    const isSelected = selectedUsers.find(u => u.id === item.id);

    return (
      <TouchableOpacity
        style={[
          styles.userItem,
          { borderBottomColor: theme.colors.divider }
        ]}
        onPress={() => toggleUserSelection(item)}
      >
        <View style={[
          styles.avatar,
          { backgroundColor: theme.colors.primary }
        ]}>
          {item.avatar_url ? (
            <Image
              source={{ uri: item.avatar_url }}
              style={styles.avatarImage}
            />
          ) : (
            <Text style={styles.avatarText}>
              {getInitials(item.display_name || item.username)}
            </Text>
          )}
        </View>

        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: theme.colors.textPrimary }]}>
            {item.display_name || item.username}
          </Text>
          {item.display_name && (
            <Text style={[styles.userHandle, { color: theme.colors.textSecondary }]}>
              @{item.username}
            </Text>
          )}
        </View>

        <View style={[
          styles.checkbox,
          {
            borderColor: isSelected ? theme.colors.primary : theme.colors.border,
            backgroundColor: isSelected ? theme.colors.primary : 'transparent'
          }
        ]}>
          {isSelected && (
            <Ionicons name="checkmark" size={16} color="#fff" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSelectedUser = ({ item }) => (
    <View style={styles.selectedUserChip}>
      <View style={[
        styles.smallAvatar,
        { backgroundColor: theme.colors.primary }
      ]}>
        {item.avatar_url ? (
          <Image
            source={{ uri: item.avatar_url }}
            style={styles.smallAvatarImage}
          />
        ) : (
          <Text style={styles.smallAvatarText}>
            {getInitials(item.display_name || item.username)}
          </Text>
        )}
      </View>
      <Text style={[styles.chipText, { color: theme.colors.textPrimary }]}>
        {item.display_name?.split(' ')[0] || item.username}
      </Text>
      <TouchableOpacity
        onPress={() => toggleUserSelection(item)}
        style={styles.removeButton}
      >
        <Ionicons name="close" size={16} color={theme.colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: theme.colors.background }
    ]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={[
          styles.header,
          {
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.divider
          }
        ]}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
            Create Group
          </Text>
          <TouchableOpacity
            style={[
              styles.createButton,
              {
                backgroundColor: groupName.trim() && selectedUsers.length > 0
                  ? theme.colors.primary
                  : theme.colors.border
              }
            ]}
            onPress={createGroup}
            disabled={loading || !groupName.trim() || selectedUsers.length === 0}
          >
            <Text style={[
              styles.createButtonText,
              {
                color: groupName.trim() && selectedUsers.length > 0
                  ? '#fff'
                  : theme.colors.textSecondary
              }
            ]}>
              {loading ? "Creating..." : "Create"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Group Info */}
        <View style={[styles.groupInfo, { backgroundColor: theme.colors.surface }]}>
          <TextInput
            style={[
              styles.groupNameInput,
              {
                color: theme.colors.textPrimary,
                borderBottomColor: theme.colors.border
              }
            ]}
            placeholder="Group name"
            placeholderTextColor={theme.colors.textSecondary}
            value={groupName}
            onChangeText={setGroupName}
            maxLength={50}
          />
          <TextInput
            style={[
              styles.groupDescriptionInput,
              {
                color: theme.colors.textPrimary,
                borderBottomColor: theme.colors.border
              }
            ]}
            placeholder="Group description (optional)"
            placeholderTextColor={theme.colors.textSecondary}
            value={groupDescription}
            onChangeText={setGroupDescription}
            maxLength={200}
            multiline
          />
        </View>

        {/* Selected Users */}
        {selectedUsers.length > 0 && (
          <View style={styles.selectedUsersContainer}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
              Selected ({selectedUsers.length})
            </Text>
            <FlatList
              data={selectedUsers}
              renderItem={renderSelectedUser}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectedUsersList}
            />
          </View>
        )}

        {/* Search */}
        <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.textPrimary }]}
            placeholder="Search users to add..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Users List */}
        <FlatList
          data={users}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.id}
          style={styles.usersList}
          showsVerticalScrollIndicator={false}
        />
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 16,
  },
  createButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  groupInfo: {
    padding: 16,
  },
  groupNameInput: {
    fontSize: 18,
    fontWeight: "600",
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  groupDescriptionInput: {
    fontSize: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    minHeight: 60,
  },
  selectedUsersContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  selectedUsersList: {
    gap: 8,
  },
  selectedUserChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.05)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  smallAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  smallAvatarImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  smallAvatarText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  chipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  removeButton: {
    padding: 2,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  usersList: {
    flex: 1,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
  },
  userHandle: {
    fontSize: 14,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
});
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  ScrollView,
  TextInput,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../utils/supabase";
import { useTheme } from "../contexts/ThemeContext";

export default function GroupInfoScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { chatId } = route.params;
  const [groupInfo, setGroupInfo] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedDescription, setEditedDescription] = useState("");

  useEffect(() => {
    loadCurrentUser();
    loadGroupInfo();
    loadParticipants();
  }, []);

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

  const loadGroupInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .eq('id', chatId)
        .eq('is_group', true)
        .single();

      if (error) throw error;
      setGroupInfo(data);
      setEditedName(data.chat_name || "");
      setEditedDescription(data.chat_description || "");
    } catch (error) {
      console.error('Error loading group info:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadParticipants = async () => {
    try {
      const { data, error } = await supabase.rpc('get_group_participants', {
        p_chat_id: chatId
      });

      if (error) throw error;
      setParticipants(data || []);

      // Check if current user is admin
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const currentUserParticipant = data?.find(p => p.user_id === user.id);
        setIsAdmin(currentUserParticipant?.is_admin || false);
      }
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  };

  const updateGroupInfo = async () => {
    try {
      const { data, error } = await supabase.rpc('update_group_chat', {
        p_chat_id: chatId,
        p_user_id: currentUser.id,
        p_chat_name: editedName.trim(),
        p_chat_description: editedDescription.trim()
      });

      if (error) throw error;

      if (data) {
        setGroupInfo(prev => ({
          ...prev,
          chat_name: editedName.trim(),
          chat_description: editedDescription.trim()
        }));
        setEditMode(false);
        Alert.alert("Success", "Group information updated successfully");
      } else {
        Alert.alert("Error", "You don't have permission to edit this group");
      }
    } catch (error) {
      console.error('Error updating group info:', error);
      Alert.alert("Error", "Failed to update group information");
    }
  };

  const removeParticipant = async (participantId) => {
    Alert.alert(
      "Remove Participant",
      "Are you sure you want to remove this participant from the group?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const { data, error } = await supabase.rpc('remove_group_participant', {
                p_chat_id: chatId,
                p_user_id: currentUser.id,
                p_participant_id: participantId
              });

              if (error) throw error;

              if (data) {
                loadParticipants();
                Alert.alert("Success", "Participant removed successfully");
              } else {
                Alert.alert("Error", "You don't have permission to remove participants");
              }
            } catch (error) {
              console.error('Error removing participant:', error);
              Alert.alert("Error", "Failed to remove participant");
            }
          }
        }
      ]
    );
  };

  const leaveGroup = async () => {
    Alert.alert(
      "Leave Group",
      "Are you sure you want to leave this group?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            try {
              const { data, error } = await supabase.rpc('remove_group_participant', {
                p_chat_id: chatId,
                p_user_id: currentUser.id,
                p_participant_id: currentUser.id
              });

              if (error) throw error;

              navigation.navigate("ChatList");
              Alert.alert("Success", "You have left the group");
            } catch (error) {
              console.error('Error leaving group:', error);
              Alert.alert("Error", "Failed to leave group");
            }
          }
        }
      ]
    );
  };

  const getInitials = (name) => {
    if (!name) return "?";
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };

  const renderParticipant = ({ item }) => (
    <View style={[
      styles.participantItem,
      { borderBottomColor: theme.colors.divider }
    ]}>
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

      <View style={styles.participantInfo}>
        <View style={styles.nameRow}>
          <Text style={[styles.participantName, { color: theme.colors.textPrimary }]}>
            {item.display_name || item.username}
            {item.user_id === currentUser?.id && " (You)"}
          </Text>
          {item.is_admin && (
            <View style={[styles.adminBadge, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.adminText}>Admin</Text>
            </View>
          )}
        </View>
        {item.display_name && (
          <Text style={[styles.participantHandle, { color: theme.colors.textSecondary }]}>
            @{item.username}
          </Text>
        )}
      </View>

      {isAdmin && item.user_id !== currentUser?.id && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeParticipant(item.user_id)}
        >
          <Ionicons name="remove-circle-outline" size={24} color={theme.colors.error || "#FF3B30"} />
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading group info...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: theme.colors.background }
    ]}>
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
          Group Info
        </Text>
        {isAdmin && (
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setEditMode(!editMode)}
          >
            <Ionicons
              name={editMode ? "checkmark" : "create-outline"}
              size={24}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content}>
        {/* Group Avatar and Info */}
        <View style={[styles.groupHeader, { backgroundColor: theme.colors.surface }]}>
          <View style={[
            styles.groupAvatar,
            { backgroundColor: theme.colors.primary }
          ]}>
            {groupInfo?.group_avatar_url ? (
              <Image
                source={{ uri: groupInfo.group_avatar_url }}
                style={styles.groupAvatarImage}
              />
            ) : (
              <Ionicons name="people" size={40} color="#fff" />
            )}
          </View>

          {editMode ? (
            <View style={styles.editContainer}>
              <TextInput
                style={[
                  styles.editNameInput,
                  {
                    color: theme.colors.textPrimary,
                    borderBottomColor: theme.colors.border
                  }
                ]}
                value={editedName}
                onChangeText={setEditedName}
                placeholder="Group name"
                placeholderTextColor={theme.colors.textSecondary}
                maxLength={50}
              />
              <TextInput
                style={[
                  styles.editDescriptionInput,
                  {
                    color: theme.colors.textPrimary,
                    borderBottomColor: theme.colors.border
                  }
                ]}
                value={editedDescription}
                onChangeText={setEditedDescription}
                placeholder="Group description"
                placeholderTextColor={theme.colors.textSecondary}
                maxLength={200}
                multiline
              />
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
                onPress={updateGroupInfo}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.groupDetails}>
              <Text style={[styles.groupName, { color: theme.colors.textPrimary }]}>
                {groupInfo?.chat_name || "Unnamed Group"}
              </Text>
              {groupInfo?.chat_description && (
                <Text style={[styles.groupDescription, { color: theme.colors.textSecondary }]}>
                  {groupInfo.chat_description}
                </Text>
              )}
              <Text style={[styles.participantCount, { color: theme.colors.textSecondary }]}>
                {participants.length} participants
              </Text>
            </View>
          )}
        </View>

        {/* Participants */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
            Participants
          </Text>
          <FlatList
            data={participants}
            renderItem={renderParticipant}
            keyExtractor={(item) => item.user_id}
            scrollEnabled={false}
          />
        </View>

        {/* Actions */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <TouchableOpacity
            style={[styles.actionItem, { borderBottomColor: theme.colors.divider }]}
            onPress={leaveGroup}
          >
            <Ionicons name="exit-outline" size={24} color={theme.colors.error || "#FF3B30"} />
            <Text style={[styles.actionText, { color: theme.colors.error || "#FF3B30" }]}>
              Leave Group
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  },
  loadingText: {
    fontSize: 16,
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
  content: {
    flex: 1,
  },
  groupHeader: {
    alignItems: "center",
    padding: 24,
    marginBottom: 16,
  },
  groupAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  groupAvatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  groupDetails: {
    alignItems: "center",
  },
  groupName: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  groupDescription: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 8,
  },
  participantCount: {
    fontSize: 14,
  },
  editContainer: {
    width: "100%",
    alignItems: "center",
  },
  editNameInput: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    marginBottom: 16,
    width: "100%",
  },
  editDescriptionInput: {
    fontSize: 16,
    textAlign: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    marginBottom: 16,
    width: "100%",
    minHeight: 40,
  },
  saveButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  participantItem: {
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
  participantInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  participantName: {
    fontSize: 16,
    fontWeight: "600",
  },
  participantHandle: {
    fontSize: 14,
    marginTop: 2,
  },
  adminBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  adminText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  removeButton: {
    padding: 8,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  actionText: {
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 16,
  },
});
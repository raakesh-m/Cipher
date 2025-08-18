import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Modal,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../utils/supabase";
import { encryptApiKey, decryptApiKey } from "../utils/translation";

export default function SettingsScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [languages, setLanguages] = useState([]);
  const [languageSearch, setLanguageSearch] = useState("");

  useEffect(() => {
    loadProfile();
    loadLanguages();
  }, []);

  const loadProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      setProfile(data);
      setDisplayName(data.display_name || "");
      setSelectedLanguage(data.preferred_language || "en");

      // Decrypt API key if it exists
      if (data.gemini_api_key_encrypted) {
        try {
          const decryptedKey = await decryptApiKey(
            data.gemini_api_key_encrypted
          );
          setGeminiApiKey(decryptedKey);
        } catch (error) {
          console.error("Failed to decrypt API key:", error);
        }
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadLanguages = async () => {
    try {
      const { data, error } = await supabase
        .from("language_codes")
        .select("*")
        .order("name");

      if (error) throw error;
      setLanguages(data || []);
    } catch (error) {
      console.error("Error loading languages:", error);
    }
  };

  const saveSettings = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      let encryptedApiKey = profile.gemini_api_key_encrypted;

      // Encrypt API key if changed
      if (
        geminiApiKey !==
        (profile.gemini_api_key_encrypted
          ? await decryptApiKey(profile.gemini_api_key_encrypted)
          : "")
      ) {
        if (geminiApiKey.trim()) {
          encryptedApiKey = await encryptApiKey(geminiApiKey.trim());
        } else {
          encryptedApiKey = null;
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || profile.username,
          preferred_language: selectedLanguage,
          gemini_api_key_encrypted: encryptedApiKey,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) throw error;

      Alert.alert("Success", "Settings saved successfully");
      await loadProfile(); // Reload profile
    } catch (error) {
      console.error("Error saving settings:", error);
      Alert.alert("Error", "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const removeApiKey = () => {
    Alert.alert(
      "Remove API Key",
      "Are you sure you want to remove your Gemini API key? Translation will be disabled.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            setGeminiApiKey("");
          },
        },
      ]
    );
  };

  const testApiKey = async () => {
    if (!geminiApiKey.trim()) {
      Alert.alert("Error", "Please enter an API key first");
      return;
    }

    try {
      const encryptedKey = await encryptApiKey(geminiApiKey.trim());
      const { translateMessage } = require("../utils/translation");

      await translateMessage("Hello, world!", selectedLanguage, encryptedKey);
      Alert.alert("Success", "API key is working correctly!");
    } catch (error) {
      Alert.alert("API Key Test Failed", error.message);
    }
  };

  const filteredLanguages = languages.filter(
    (lang) =>
      lang.name.toLowerCase().includes(languageSearch.toLowerCase()) ||
      lang.native_name.toLowerCase().includes(languageSearch.toLowerCase()) ||
      lang.code.toLowerCase().includes(languageSearch.toLowerCase())
  );

  const selectedLanguageData = languages.find(
    (lang) => lang.code === selectedLanguage
  );

  const renderLanguageItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.languageItem,
        selectedLanguage === item.code && styles.selectedLanguageItem,
      ]}
      onPress={() => {
        setSelectedLanguage(item.code);
        setShowLanguagePicker(false);
      }}
    >
      <View>
        <Text style={styles.languageName}>{item.name}</Text>
        <Text style={styles.languageNative}>{item.native_name}</Text>
      </View>
      {selectedLanguage === item.code && (
        <Ionicons name="checkmark" size={20} color="#007AFF" />
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter display name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <Text style={styles.readOnlyText}>@{profile?.username}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Language & Translation</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Preferred Language</Text>
            <TouchableOpacity
              style={styles.languageSelector}
              onPress={() => setShowLanguagePicker(true)}
            >
              <Text style={styles.languageSelectorText}>
                {selectedLanguageData
                  ? `${selectedLanguageData.name} (${selectedLanguageData.native_name})`
                  : "Select Language"}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Gemini API Key</Text>
              <TouchableOpacity onPress={testApiKey} style={styles.testButton}>
                <Text style={styles.testButtonText}>Test</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              value={geminiApiKey}
              onChangeText={setGeminiApiKey}
              placeholder="Enter your Gemini API key"
              secureTextEntry
              autoCapitalize="none"
            />
            <Text style={styles.helperText}>
              Get your free API key from Google AI Studio. This enables
              automatic message translation.
            </Text>
            {geminiApiKey && (
              <TouchableOpacity
                onPress={removeApiKey}
                style={styles.removeButton}
              >
                <Text style={styles.removeButtonText}>Remove API Key</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={saveSettings}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? "Saving..." : "Save Settings"}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showLanguagePicker}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowLanguagePicker(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Language</Text>
            <View style={styles.modalSpacer} />
          </View>

          <View style={styles.searchContainer}>
            <Ionicons
              name="search"
              size={20}
              color="#666"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search languages..."
              value={languageSearch}
              onChangeText={setLanguageSearch}
            />
          </View>

          <FlatList
            data={filteredLanguages}
            renderItem={renderLanguageItem}
            keyExtractor={(item) => item.code}
            style={styles.languageList}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e1e5e9",
  },
  readOnlyText: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#666",
    borderWidth: 1,
    borderColor: "#e1e5e9",
  },
  languageSelector: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e1e5e9",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  languageSelectorText: {
    fontSize: 16,
    color: "#1a1a1a",
  },
  helperText: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  testButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  testButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  removeButton: {
    marginTop: 8,
    alignSelf: "flex-start",
  },
  removeButtonText: {
    color: "#FF3B30",
    fontSize: 14,
    fontWeight: "500",
  },
  saveButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginVertical: 24,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e1e5e9",
  },
  modalCancel: {
    color: "#007AFF",
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  modalSpacer: {
    width: 60,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginVertical: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#e1e5e9",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  languageList: {
    flex: 1,
  },
  languageItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e5e9",
  },
  selectedLanguageItem: {
    backgroundColor: "#f0f8ff",
  },
  languageName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1a1a1a",
  },
  languageNative: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
});

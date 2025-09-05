import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Modal,
  FlatList,
  Animated,
  Dimensions,
  StatusBar,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../utils/supabase";
import { encryptApiKey, decryptApiKey } from "../utils/translation";

const { width } = Dimensions.get('window');

const SimpleModernSettingsScreen = ({ navigation }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [languages, setLanguages] = useState([]);
  const [languageSearch, setLanguageSearch] = useState("");
  const [testingApiKey, setTestingApiKey] = useState(false);
  
  // Animation references
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const testButtonScale = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadProfile();
    loadLanguages();
    
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const animateButton = (animValue, callback) => {
    Animated.sequence([
      Animated.timing(animValue, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(animValue, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(callback);
  };

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
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

      if (data.gemini_api_key_encrypted) {
        try {
          const decryptedKey = await decryptApiKey(data.gemini_api_key_encrypted);
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
      // Fallback languages
      setLanguages([
        { code: "en", name: "English", native_name: "English" },
        { code: "es", name: "Spanish", native_name: "Español" },
        { code: "fr", name: "French", native_name: "Français" },
        { code: "de", name: "German", native_name: "Deutsch" },
        { code: "it", name: "Italian", native_name: "Italiano" },
        { code: "pt", name: "Portuguese", native_name: "Português" },
        { code: "ru", name: "Russian", native_name: "Русский" },
        { code: "ja", name: "Japanese", native_name: "日本語" },
        { code: "ko", name: "Korean", native_name: "한국어" },
        { code: "zh", name: "Chinese", native_name: "中文" },
      ]);
    }
  };

  const saveSettings = async () => {
    if (!profile) return;

    setSaving(true);
    
    // Start progress animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: false,
    }).start();

    try {
      let encryptedApiKey = profile.gemini_api_key_encrypted;

      if (
        geminiApiKey !== (profile.gemini_api_key_encrypted
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

      // Success animation
      Animated.timing(successAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => {
          Animated.timing(successAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start();
        }, 1500);
      });

      Alert.alert("✅ Success!", "Settings saved successfully!");
      await loadProfile();
    } catch (error) {
      console.error("Error saving settings:", error);
      Alert.alert("❌ Error", "Failed to save settings");
    } finally {
      setSaving(false);
      progressAnim.setValue(0);
    }
  };

  const testApiKey = async () => {
    if (!geminiApiKey.trim()) {
      Alert.alert("❌ Error", "Please enter an API key first");
      return;
    }

    animateButton(testButtonScale);
    setTestingApiKey(true);

    // Start progress animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: false,
    }).start();

    try {
      const encryptedKey = await encryptApiKey(geminiApiKey.trim());
      const { translateMessage } = require("../utils/translation");

      await translateMessage("Hello, world!", selectedLanguage, encryptedKey);
      
      // Success animation
      Animated.timing(successAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();

      Alert.alert(
        "🎉 Success!", 
        "API key is working perfectly! Your translation service is ready.", 
        [{ 
          text: "Awesome!", 
          onPress: () => {
            Animated.timing(successAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }).start();
          }
        }]
      );
    } catch (error) {
      console.error("API key test error:", error);
      Alert.alert(
        "❌ Test Failed", 
        error.message,
        [{ text: "Try Again", style: "cancel" }]
      );
    } finally {
      setTestingApiKey(false);
      progressAnim.setValue(0);
    }
  };

  const removeApiKey = () => {
    Alert.alert(
      "🗑️ Remove API Key",
      "Are you sure you want to remove your Gemini API key? Translation will be disabled.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => setGeminiApiKey(""),
        },
      ]
    );
  };

  const filteredLanguages = languages.filter(
    (lang) =>
      lang.name?.toLowerCase().includes(languageSearch.toLowerCase()) ||
      lang.native_name?.toLowerCase().includes(languageSearch.toLowerCase()) ||
      lang.code?.toLowerCase().includes(languageSearch.toLowerCase())
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
      activeOpacity={0.7}
    >
      <View style={styles.languageInfo}>
        <Text style={styles.languageName}>{item.name}</Text>
        <Text style={styles.languageNative}>{item.native_name}</Text>
      </View>
      {selectedLanguage === item.code && (
        <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="settings" size={60} color="#6366f1" />
        <Text style={styles.loadingText}>Loading your settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6366f1" />
      
      {/* Success Overlay */}
      <Animated.View
        style={[
          styles.successOverlay,
          {
            opacity: successAnim,
            transform: [{ scale: successAnim }],
          }
        ]}
        pointerEvents="none"
      >
        <Ionicons name="checkmark-circle" size={100} color="#4CAF50" />
        <Text style={styles.successText}>Success!</Text>
      </Animated.View>

      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }
          ]}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.headerSpacer} />
        </Animated.View>

        <Animated.ScrollView
          style={[
            styles.scrollView,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person-circle" size={24} color="#6366f1" />
              <Text style={styles.sectionTitle}>Profile</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Display Name</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter display name"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <View style={styles.readOnlyContainer}>
                <Text style={styles.readOnlyText}>@{profile?.username}</Text>
              </View>
            </View>
          </View>

          {/* Language & Translation Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="language" size={24} color="#6366f1" />
              <Text style={styles.sectionTitle}>Language & Translation</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Preferred Language</Text>
              <TouchableOpacity
                style={styles.languageSelector}
                onPress={() => setShowLanguagePicker(true)}
                activeOpacity={0.8}
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
                <Animated.View style={{ transform: [{ scale: testButtonScale }] }}>
                  <TouchableOpacity
                    onPress={testApiKey}
                    style={[
                      styles.testButton,
                      testingApiKey && styles.testButtonTesting,
                    ]}
                    disabled={testingApiKey}
                    activeOpacity={0.8}
                  >
                    <View style={styles.testButtonContent}>
                      {testingApiKey && (
                        <View style={styles.loadingDot} />
                      )}
                      <Ionicons 
                        name={testingApiKey ? "hourglass" : "flash"} 
                        size={16} 
                        color="#fff" 
                      />
                      <Text style={styles.testButtonText}>
                        {testingApiKey ? "Testing..." : "Test"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              </View>

              <TextInput
                style={styles.input}
                value={geminiApiKey}
                onChangeText={setGeminiApiKey}
                placeholder="Enter your Gemini API key"
                placeholderTextColor="#999"
                secureTextEntry
                autoCapitalize="none"
              />

              <Text style={styles.helperText}>
                🚀 Get your free API key from Google AI Studio. This enables automatic message translation with AI power.
              </Text>

              {geminiApiKey && (
                <TouchableOpacity
                  onPress={removeApiKey}
                  style={styles.removeButton}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash" size={16} color="#FF6B6B" />
                  <Text style={styles.removeButtonText}>Remove API Key</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Progress Indicator */}
          {(saving || testingApiKey) && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {saving ? '💾 Saving your settings...' : '🧪 Testing your API key...'}
              </Text>
            </View>
          )}

          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              saving && styles.saveButtonDisabled,
            ]}
            onPress={() => animateButton(testButtonScale, saveSettings)}
            disabled={saving}
            activeOpacity={0.8}
          >
            <View style={styles.saveButtonContent}>
              {saving && <View style={styles.loadingDot} />}
              <Ionicons 
                name={saving ? "hourglass" : "checkmark-circle"} 
                size={20} 
                color="#fff" 
              />
              <Text style={styles.saveButtonText}>
                {saving ? "Saving..." : "Save Settings"}
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.ScrollView>

        {/* Language Picker Modal */}
        <Modal
          visible={showLanguagePicker}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setShowLanguagePicker(false)}
              >
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
                placeholderTextColor="#999"
                value={languageSearch}
                onChangeText={setLanguageSearch}
              />
            </View>

            <FlatList
              data={filteredLanguages}
              renderItem={renderLanguageItem}
              keyExtractor={(item) => item.code}
              style={styles.languageList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#6366f1',
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    color: '#6366f1',
    fontSize: 18,
    marginTop: 20,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSpacer: {
    width: 44,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
    borderRadius: 20,
    padding: 24,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginLeft: 12,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  input: {
    borderRadius: 16,
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 18,
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  readOnlyContainer: {
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 18,
  },
  readOnlyText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  languageSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 18,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  languageSelectorText: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  helperText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    lineHeight: 20,
  },
  testButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  testButtonTesting: {
    backgroundColor: '#FF9800',
  },
  testButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 6,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
  },
  removeButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  progressContainer: {
    marginVertical: 16,
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  progressText: {
    color: '#1f2937',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  saveButton: {
    borderRadius: 16,
    marginVertical: 20,
    backgroundColor: '#4CAF50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.8,
  },
  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    zIndex: 1000,
  },
  successText: {
    color: '#4CAF50',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  modalCancel: {
    color: '#6366f1',
    fontSize: 18,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  modalSpacer: {
    width: 60,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 16,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  languageList: {
    flex: 1,
  },
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 4,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  selectedLanguageItem: {
    borderColor: '#4CAF50',
    backgroundColor: '#f0f9f0',
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  languageNative: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
});

export default SimpleModernSettingsScreen;
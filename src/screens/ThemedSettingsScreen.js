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
import { useTheme } from "../contexts/ThemeContext";
import { supabase } from "../../utils/supabase";
import { encryptApiKey, decryptApiKey } from "../utils/translation";
import onlineStatusService from "../services/onlineStatusService";

const { width } = Dimensions.get('window');

const ThemedSettingsScreen = ({ navigation }) => {
  const { theme, isDark } = useTheme();
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
  const [onlineStatusPrivacy, setOnlineStatusPrivacy] = useState("everyone");
  const [lastSeenPrivacy, setLastSeenPrivacy] = useState("everyone");
  const [showPrivacyPicker, setShowPrivacyPicker] = useState(null);
  
  // Animation references
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
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
      setOnlineStatusPrivacy(data.online_status_privacy || "everyone");
      setLastSeenPrivacy(data.last_seen_privacy || "everyone");

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
          online_status_privacy: onlineStatusPrivacy,
          last_seen_privacy: lastSeenPrivacy,
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

  const privacyOptions = [
    {
      key: 'everyone',
      title: 'Everyone',
      subtitle: 'All users can see this information',
      icon: 'globe-outline'
    },
    {
      key: 'contacts',
      title: 'My Contacts',
      subtitle: 'Only people you\'ve chatted with',
      icon: 'people-outline'
    },
    {
      key: 'nobody',
      title: 'Nobody',
      subtitle: 'Hide this information from everyone',
      icon: 'eye-off-outline'
    }
  ];


  const renderLanguageItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.listItem,
        { 
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
        selectedLanguage === item.code && {
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.primary + '10',
        },
      ]}
      onPress={() => {
        setSelectedLanguage(item.code);
        setShowLanguagePicker(false);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.languageInfo}>
        <Text style={[styles.listItemTitle, { color: theme.colors.text }]}>{item.name}</Text>
        <Text style={[styles.listItemSubtitle, { color: theme.colors.textSecondary }]}>
          {item.native_name}
        </Text>
      </View>
      {selectedLanguage === item.code && (
        <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
      )}
    </TouchableOpacity>
  );

  const renderPrivacyItem = ({ item }) => {
    const currentPrivacy = showPrivacyPicker === 'online_status' ? onlineStatusPrivacy : lastSeenPrivacy;

    return (
      <TouchableOpacity
        style={[
          styles.listItem,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
          },
          currentPrivacy === item.key && {
            borderColor: theme.colors.primary,
            backgroundColor: theme.colors.primary + '10',
          },
        ]}
        onPress={() => {
          if (showPrivacyPicker === 'online_status') {
            setOnlineStatusPrivacy(item.key);
          } else {
            setLastSeenPrivacy(item.key);
          }
          setShowPrivacyPicker(null);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.themeItemContent}>
          <Ionicons
            name={item.icon}
            size={24}
            color={currentPrivacy === item.key ? theme.colors.primary : theme.colors.textSecondary}
          />
          <View style={styles.themeItemText}>
            <Text style={[styles.listItemTitle, { color: theme.colors.text }]}>{item.title}</Text>
            <Text style={[styles.listItemSubtitle, { color: theme.colors.textSecondary }]}>
              {item.subtitle}
            </Text>
          </View>
        </View>
        {currentPrivacy === item.key && (
          <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  const renderThemeItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.listItem,
        { 
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
        themePreference === item.key && {
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.primary + '10',
        },
      ]}
      onPress={() => handleThemeChange(item.key)}
      activeOpacity={0.7}
    >
      <View style={styles.themeItemContent}>
        <Ionicons 
          name={item.icon} 
          size={24} 
          color={themePreference === item.key ? theme.colors.primary : theme.colors.textSecondary} 
        />
        <View style={styles.themeItemText}>
          <Text style={[styles.listItemTitle, { color: theme.colors.text }]}>{item.title}</Text>
          <Text style={[styles.listItemSubtitle, { color: theme.colors.textSecondary }]}>
            {item.subtitle}
          </Text>
        </View>
      </View>
      {themePreference === item.key && (
        <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
      )}
    </TouchableOpacity>
  );

  const styles = createStyles(theme);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.surface }]}>
        <Ionicons name="settings" size={60} color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>
          Loading your settings...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar 
        barStyle={isDark ? "light-content" : "dark-content"} 
        backgroundColor={theme.colors.background}
      />
      
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
        <Ionicons name="checkmark-circle" size={100} color={theme.colors.success} />
        <Text style={[styles.successText, { color: theme.colors.success }]}>Success!</Text>
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
            style={[styles.backButton, { backgroundColor: theme.colors.primary + '20' }]}
          >
            <Ionicons name="chevron-back" size={28} color={theme.colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Settings</Text>
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
          <View style={[styles.section, { backgroundColor: theme.colors.card }, theme.shadows.md]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person" size={22} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Profile</Text>
            </View>

            <TouchableOpacity
              style={[styles.settingRow, { borderColor: theme.colors.divider }]}
              onPress={() => navigation.navigate("Profile")}
              activeOpacity={0.7}
            >
              <View style={styles.settingContent}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Manage Profile</Text>
                  <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>
                    Edit picture, bio, and personal information
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
              </View>
            </TouchableOpacity>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Display Name</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: theme.colors.inputBackground,
                  borderColor: theme.colors.inputBorder,
                  color: theme.colors.text,
                }]}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter display name"
                placeholderTextColor={theme.colors.inputPlaceholder}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Username</Text>
              <View style={[styles.readOnlyContainer, { 
                backgroundColor: theme.colors.divider,
                borderColor: theme.colors.border,
              }]}>
                <Text style={[styles.readOnlyText, { color: theme.colors.textSecondary }]}>
                  @{profile?.username}
                </Text>
              </View>
            </View>
          </View>

          {/* Language & Translation Section */}
          <View style={[styles.section, { backgroundColor: theme.colors.card }, theme.shadows.md]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="language" size={22} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Translation</Text>
            </View>

            <TouchableOpacity
              style={[styles.settingRow, { borderColor: theme.colors.divider }]}
              onPress={() => setShowLanguagePicker(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingContent}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Language</Text>
                  <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>
                    {selectedLanguageData ? selectedLanguageData.name : "Select Language"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
              </View>
            </TouchableOpacity>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Gemini API Key</Text>
                <Animated.View style={{ transform: [{ scale: testButtonScale }] }}>
                  <TouchableOpacity
                    onPress={testApiKey}
                    style={[
                      styles.testButton,
                      { backgroundColor: testingApiKey ? theme.colors.warning : theme.colors.success },
                    ]}
                    disabled={testingApiKey}
                    activeOpacity={0.8}
                  >
                    <View style={styles.testButtonContent}>
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
                style={[styles.input, { 
                  backgroundColor: theme.colors.inputBackground,
                  borderColor: theme.colors.inputBorder,
                  color: theme.colors.text,
                }]}
                value={geminiApiKey}
                onChangeText={setGeminiApiKey}
                placeholder="Enter your Gemini API key"
                placeholderTextColor={theme.colors.inputPlaceholder}
                secureTextEntry
                autoCapitalize="none"
              />

              <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>
                Get your free API key from Google AI Studio to enable AI-powered translation.
              </Text>

              {geminiApiKey && (
                <TouchableOpacity
                  onPress={removeApiKey}
                  style={styles.removeButton}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash" size={16} color={theme.colors.error} />
                  <Text style={[styles.removeButtonText, { color: theme.colors.error }]}>
                    Remove API Key
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Privacy Section */}
          <View style={[styles.section, { backgroundColor: theme.colors.card }, theme.shadows.md]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="shield-checkmark" size={22} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Privacy</Text>
            </View>

            <TouchableOpacity
              style={[styles.settingRow, { borderColor: theme.colors.divider }]}
              onPress={() => setShowPrivacyPicker('online_status')}
              activeOpacity={0.7}
            >
              <View style={styles.settingContent}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Online Status</Text>
                  <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>
                    {onlineStatusPrivacy === 'everyone' ? 'Everyone' :
                     onlineStatusPrivacy === 'contacts' ? 'My Contacts' : 'Nobody'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderColor: theme.colors.divider }]}
              onPress={() => setShowPrivacyPicker('last_seen')}
              activeOpacity={0.7}
            >
              <View style={styles.settingContent}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Last Seen</Text>
                  <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>
                    {lastSeenPrivacy === 'everyone' ? 'Everyone' :
                     lastSeenPrivacy === 'contacts' ? 'My Contacts' : 'Nobody'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
              </View>
            </TouchableOpacity>

            <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>
              Control who can see your online status and when you were last active. "My Contacts" means only people you've chatted with.
            </Text>
          </View>

          {/* Progress Indicator */}
          {(saving || testingApiKey) && (
            <View style={[styles.progressContainer, { backgroundColor: theme.colors.card }, theme.shadows.sm]}>
              <View style={[styles.progressBar, { backgroundColor: theme.colors.divider }]}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    { backgroundColor: theme.colors.primary },
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
              <Text style={[styles.progressText, { color: theme.colors.text }]}>
                {saving ? '💾 Saving your settings...' : '🧪 Testing your API key...'}
              </Text>
            </View>
          )}

          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: saving ? theme.colors.textTertiary : theme.colors.primary },
              theme.shadows.md,
            ]}
            onPress={() => animateButton(testButtonScale, saveSettings)}
            disabled={saving}
            activeOpacity={0.8}
          >
            <View style={styles.saveButtonContent}>
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

        {/* Theme Picker Modal */}
        <Modal
          visible={showThemePicker}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.modalHeader, { 
              backgroundColor: theme.colors.card,
              borderBottomColor: theme.colors.border,
            }]}>
              <TouchableOpacity onPress={() => setShowThemePicker(false)}>
                <Text style={[styles.modalCancel, { color: theme.colors.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Choose Theme</Text>
              <View style={styles.modalSpacer} />
            </View>

            <FlatList
              data={themeOptions}
              renderItem={renderThemeItem}
              keyExtractor={(item) => item.key}
              style={styles.modalList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 20 }}
            />
          </View>
        </Modal>

        {/* Language Picker Modal */}
        <Modal
          visible={showLanguagePicker}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.modalHeader, { 
              backgroundColor: theme.colors.card,
              borderBottomColor: theme.colors.border,
            }]}>
              <TouchableOpacity onPress={() => setShowLanguagePicker(false)}>
                <Text style={[styles.modalCancel, { color: theme.colors.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Select Language</Text>
              <View style={styles.modalSpacer} />
            </View>

            <View style={[styles.searchContainer, { 
              backgroundColor: theme.colors.inputBackground,
              borderColor: theme.colors.inputBorder,
            }]}>
              <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholder="Search languages..."
                placeholderTextColor={theme.colors.inputPlaceholder}
                value={languageSearch}
                onChangeText={setLanguageSearch}
              />
            </View>

            <FlatList
              data={filteredLanguages}
              renderItem={renderLanguageItem}
              keyExtractor={(item) => item.code}
              style={styles.modalList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 20 }}
            />
          </View>
        </Modal>

        {/* Privacy Picker Modal */}
        <Modal
          visible={showPrivacyPicker !== null}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.modalHeader, {
              backgroundColor: theme.colors.card,
              borderBottomColor: theme.colors.border,
            }]}>
              <TouchableOpacity onPress={() => setShowPrivacyPicker(null)}>
                <Text style={[styles.modalCancel, { color: theme.colors.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {showPrivacyPicker === 'online_status' ? 'Online Status Privacy' : 'Last Seen Privacy'}
              </Text>
              <View style={styles.modalSpacer} />
            </View>

            <FlatList
              data={privacyOptions}
              renderItem={renderPrivacyItem}
              keyExtractor={(item) => item.key}
              style={styles.modalList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 20 }}
            />
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    marginTop: 20,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerSpacer: {
    width: 44,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 10,
  },
  settingRow: {
    paddingVertical: 4,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  settingContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  settingValue: {
    fontSize: 14,
    marginTop: 2,
  },
  settingAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themePreview: {
    width: 32,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themePreviewInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  advancedThemeRow: {
    marginTop: 8,
    paddingVertical: 8,
  },
  advancedThemeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  advancedThemeText: {
    fontSize: 14,
    fontWeight: '500',
    marginHorizontal: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  readOnlyContainer: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
  },
  readOnlyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  helperText: {
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  testButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
  },
  removeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  progressContainer: {
    marginVertical: 16,
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
  },
  progressBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  saveButton: {
    borderRadius: 12,
    marginVertical: 20,
  },
  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 1000,
  },
  successText: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalCancel: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalSpacer: {
    width: 60,
  },
  modalList: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  listItemSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  languageInfo: {
    flex: 1,
  },
  themeItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  themeItemText: {
    marginLeft: 12,
    flex: 1,
  },
});

export default ThemedSettingsScreen;
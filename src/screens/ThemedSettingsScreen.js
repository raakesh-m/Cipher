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
  Switch,
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
  const [testingApiKey, setTestingApiKey] = useState(false);
  const [translationEnabled, setTranslationEnabled] = useState(true);
  const [privacyStatus, setPrivacyStatus] = useState("everyone");
  
  // Animation references
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const testButtonScale = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;


  useEffect(() => {
    loadProfile();

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
      setTranslationEnabled(data.translation_enabled !== false); // Default to true if not set
      // Use the same privacy setting for both online status and last seen
      setPrivacyStatus(data.online_status_privacy || data.last_seen_privacy || "everyone");

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
          gemini_api_key_encrypted: encryptedApiKey,
          translation_enabled: translationEnabled,
          online_status_privacy: privacyStatus,
          last_seen_privacy: privacyStatus,
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

      // Update online status service with new privacy settings
      try {
        await onlineStatusService.updatePrivacySettings(privacyStatus, privacyStatus);
      } catch (error) {
        console.error("Error updating privacy settings in service:", error);
      }

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

      await translateMessage("Hello, world!", "en", encryptedKey);
      
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



  const privacyOptions = [
    {
      key: 'nobody',
      title: 'Nobody',
      subtitle: 'Hide your status and last seen from everyone',
      icon: 'eye-off-outline',
      privacy: 'Hidden',
      color: '#C62828'
    },
    {
      key: 'contacts',
      title: 'Contacts',
      subtitle: 'Only people you\'ve chatted with can see your status',
      icon: 'people-outline',
      privacy: 'Limited',
      color: '#E65100'
    },
    {
      key: 'everyone',
      title: 'Everyone',
      subtitle: 'Anyone can see your online status and last seen',
      icon: 'globe-outline',
      privacy: 'Public',
      color: '#2E7D32'
    }
  ];






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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.threadBackground }]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
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

      {/* Custom Curved Header */}
      <View style={[styles.curvedHeader, { backgroundColor: "#FFFFFF" }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color="#000000" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: "#000000" }]}>Settings</Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Section */}
        <View style={[styles.modernCard, { backgroundColor: "#FFFFFF" }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
                <Ionicons name="person" size={20} color={theme.colors.primary} />
              </View>
              <Text style={[styles.cardTitle, { color: "#000000" }]}>Profile</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.modernSettingRow}
            onPress={() => navigation.navigate("Profile")}
            activeOpacity={0.7}
          >
            <View style={styles.modernSettingContent}>
              <View style={styles.modernSettingInfo}>
                <Text style={[styles.modernSettingTitle, { color: "#000000" }]}>Manage Profile</Text>
                <Text style={[styles.modernSettingSubtitle, { color: "#888888" }]}>
                  Edit picture, bio, and personal information
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#CCCCCC" />
            </View>
          </TouchableOpacity>

          <View style={styles.modernInputGroup}>
            <Text style={[styles.modernLabel, { color: "#000000" }]}>Display Name</Text>
            <View style={styles.modernInputContainer}>
              <TextInput
                style={[styles.modernInput, { color: "#000000" }]}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter display name"
                placeholderTextColor="#AAAAAA"
              />
            </View>
          </View>

          <View style={styles.modernInputGroup}>
            <Text style={[styles.modernLabel, { color: "#000000" }]}>Username</Text>
            <View style={styles.modernReadOnlyContainer}>
              <Text style={[styles.modernReadOnlyText, { color: "#888888" }]}>
                @{profile?.username}
              </Text>
            </View>
          </View>
        </View>

        {/* Translation Section */}
        <View style={[styles.modernCard, { backgroundColor: "#FFFFFF" }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
                <Ionicons name="language" size={20} color={theme.colors.primary} />
              </View>
              <Text style={[styles.cardTitle, { color: "#000000" }]}>Translation</Text>
            </View>
          </View>


          {/* Translation Toggle */}
          <View style={styles.modernSettingRow}>
            <View style={styles.modernSettingContent}>
              <View style={styles.modernSettingInfo}>
                <Text style={[styles.modernSettingTitle, { color: "#000000" }]}>Enable Translation</Text>
                <Text style={[styles.modernSettingSubtitle, { color: "#888888" }]}>
                  {translationEnabled ? 'Messages will be translated using AI' : 'Show original messages without translation'}
                </Text>
              </View>
              <Switch
                value={translationEnabled}
                onValueChange={setTranslationEnabled}
                trackColor={{ false: '#E5E5E5', true: theme.colors.primary + '30' }}
                thumbColor={translationEnabled ? theme.colors.primary : '#F4F3F4'}
                style={styles.toggleSwitch}
              />
            </View>
          </View>

          <View style={styles.modernInputGroup}>
            <View style={styles.modernLabelRow}>
              <Text style={[styles.modernLabel, { color: "#000000" }]}>Gemini API Key</Text>
              <Animated.View style={{ transform: [{ scale: testButtonScale }] }}>
                <TouchableOpacity
                  onPress={testApiKey}
                  style={[
                    styles.modernTestButton,
                    {
                      backgroundColor: testingApiKey ? "#FFA500" : theme.colors.primary,
                      opacity: translationEnabled ? 1 : 0.5
                    },
                  ]}
                  disabled={testingApiKey || !translationEnabled}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={testingApiKey ? "hourglass" : "flash"}
                    size={14}
                    color="#fff"
                  />
                  <Text style={styles.modernTestButtonText}>
                    {testingApiKey ? "Testing..." : "Test"}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </View>

            <View style={[styles.modernInputContainer, { opacity: translationEnabled ? 1 : 0.5 }]}>
              <TextInput
                style={[styles.modernInput, { color: "#000000" }]}
                value={geminiApiKey}
                onChangeText={setGeminiApiKey}
                placeholder="Enter your Gemini API key"
                placeholderTextColor="#AAAAAA"
                secureTextEntry
                autoCapitalize="none"
                editable={translationEnabled}
              />
            </View>

            <Text style={[styles.modernHelperText, { color: "#888888" }]}>
              {translationEnabled
                ? "Get your free API key from Google AI Studio to enable AI-powered translation."
                : "Translation is disabled. Enable it above to configure your API key."
              }
            </Text>

            {geminiApiKey && (
              <TouchableOpacity
                onPress={removeApiKey}
                style={[styles.modernRemoveButton, { opacity: translationEnabled ? 1 : 0.5 }]}
                activeOpacity={0.8}
                disabled={!translationEnabled}
              >
                <Ionicons name="trash" size={16} color="#FF3B30" />
                <Text style={[styles.modernRemoveButtonText, { color: "#FF3B30" }]}>
                  Remove API Key
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Privacy & Online Status Section */}
        <View style={[styles.modernCard, { backgroundColor: "#FFFFFF" }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
                <Ionicons name="shield-checkmark" size={20} color={theme.colors.primary} />
              </View>
              <Text style={[styles.cardTitle, { color: "#000000" }]}>Privacy & Online Status</Text>
            </View>
          </View>

          {/* Combined Privacy Setting */}
          <View style={styles.privacyToggleContainer}>
            <Text style={[styles.privacyToggleTitle, { color: "#000000" }]}>
              Who can see your last seen and online status
            </Text>
            <Text style={[styles.privacyToggleSubtitle, { color: "#888888" }]}>
              {privacyOptions.find(option => option.key === privacyStatus)?.subtitle}
            </Text>

            {/* Inline Toggle Options */}
            <View style={styles.inlineToggleContainer}>
              {privacyOptions.map((option, index) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.toggleOption,
                    {
                      backgroundColor: privacyStatus === option.key ? option.color + '15' : '#F8F8F8',
                      borderColor: privacyStatus === option.key ? option.color : '#E5E5E5',
                    },
                    index === 0 && styles.toggleOptionFirst,
                    index === privacyOptions.length - 1 && styles.toggleOptionLast,
                  ]}
                  onPress={() => setPrivacyStatus(option.key)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.toggleOptionContent, {
                    opacity: privacyStatus === option.key ? 1 : 0.4
                  }]}>
                    <Ionicons
                      name={option.icon}
                      size={20}
                      color={privacyStatus === option.key ? option.color : '#999'}
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Privacy Warning */}
          <View style={styles.privacyWarning}>
            <Ionicons name="information-circle-outline" size={16} color="#FF9500" />
            <Text style={[styles.privacyWarningText, { color: "#FF9500" }]}>
              If you hide your status, you won't be able to see others' status either
            </Text>
          </View>

          <Text style={[styles.modernHelperText, { color: "#888888" }]}>
            Your privacy settings apply equally - if you can't see someone's status, they can't see yours.
            This ensures fair privacy for all users.
          </Text>
        </View>


        {/* Progress Indicator */}
        {(saving || testingApiKey) && (
          <View style={[styles.modernProgressContainer, { backgroundColor: "#FFFFFF" }]}>
            <View style={styles.modernProgressBar}>
              <Animated.View
                style={[
                  styles.modernProgressFill,
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
            <Text style={[styles.modernProgressText, { color: "#000000" }]}>
              {saving ? '💾 Saving your settings...' : '🧪 Testing your API key...'}
            </Text>
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.modernSaveButton,
            { backgroundColor: saving ? "#CCCCCC" : theme.colors.primary },
          ]}
          onPress={() => animateButton(testButtonScale, saveSettings)}
          disabled={saving}
          activeOpacity={0.8}
        >
          <View style={styles.modernSaveButtonContent}>
            <Ionicons
              name={saving ? "hourglass" : "checkmark-circle"}
              size={18}
              color="#fff"
            />
            <Text style={styles.modernSaveButtonText}>
              {saving ? "Saving..." : "Save Settings"}
            </Text>
          </View>
        </TouchableOpacity>
      </ScrollView>



    </SafeAreaView>
  ); // Fixed JSX structure
};

const createStyles = (theme) => StyleSheet.create({
  container: {
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
  // Modern Header Styles (matching ChatScreen)
  curvedHeader: {
    paddingTop: Platform.OS === "ios" ? 0 : 10,
    paddingBottom: 0,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  // Modern Card Styles
  modernCard: {
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    marginBottom: 16,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  // Modern Setting Row Styles
  modernSettingRow: {
    paddingVertical: 12,
    marginBottom: 8,
  },
  modernSettingContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modernSettingInfo: {
    flex: 1,
  },
  modernSettingTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  modernSettingSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  // Modern Input Styles
  modernInputGroup: {
    marginBottom: 16,
  },
  modernLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  modernLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modernInputContainer: {
    backgroundColor: "#F8F8F8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  modernInput: {
    padding: 16,
    fontSize: 16,
    fontWeight: "500",
  },
  modernReadOnlyContainer: {
    backgroundColor: "#F8F8F8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    padding: 16,
  },
  modernReadOnlyText: {
    fontSize: 16,
    fontWeight: "500",
  },
  modernHelperText: {
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  modernTestButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  modernTestButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  modernRemoveButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    padding: 8,
  },
  modernRemoveButtonText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  // Modern Progress and Button Styles
  modernProgressContainer: {
    marginVertical: 16,
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  modernProgressBar: {
    width: "100%",
    height: 4,
    backgroundColor: "#F0F0F0",
    borderRadius: 2,
    overflow: "hidden",
  },
  modernProgressFill: {
    height: "100%",
    borderRadius: 2,
  },
  modernProgressText: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
  },
  modernSaveButton: {
    borderRadius: 16,
    marginVertical: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  modernSaveButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modernSaveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 6,
  },
  // Success Overlay
  successOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    zIndex: 1000,
  },
  successText: {
    fontSize: 24,
    fontWeight: "700",
    marginTop: 16,
  },
  // Modern Modal Styles
  modalContainer: {
    flex: 1,
  },
  modernModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  modernModalCancel: {
    fontSize: 16,
    fontWeight: "600",
  },
  modernModalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  modalSpacer: {
    width: 60,
  },
  modalList: {
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
  // Enhanced Privacy Settings Styles
  privacyWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  privacyWarningText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  // Inline Toggle Styles
  privacyToggleContainer: {
    marginBottom: 16,
  },
  privacyToggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  privacyToggleSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  inlineToggleContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRightWidth: 1,
    borderRightColor: '#E5E5E5',
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleOptionFirst: {
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  toggleOptionLast: {
    borderRightWidth: 0,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  toggleOptionContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  // Toggle Switch Styles
  toggleSwitch: {
    transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
  },
});

export default ThemedSettingsScreen;
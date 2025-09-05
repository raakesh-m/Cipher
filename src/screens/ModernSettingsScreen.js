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
  Haptics,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { supabase } from "../../utils/supabase";
import { encryptApiKey, decryptApiKey } from "../utils/translation";

const { width, height } = Dimensions.get('window');

const ModernSettingsScreen = ({ navigation }) => {
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
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadProfile();
    loadLanguages();
    
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous pulse animation for active elements
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    return () => pulseLoop.stop();
  }, []);

  const hapticFeedback = (type = 'light') => {
    if (Platform.OS === 'ios') {
      switch (type) {
        case 'light':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'error':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
      }
    }
  };

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
      // Fallback languages if database query fails
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

    hapticFeedback('medium');
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
      hapticFeedback('success');
      Animated.timing(successAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => {
          Animated.timing(successAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }).start();
        }, 2000);
      });

      await loadProfile();
    } catch (error) {
      console.error("Error saving settings:", error);
      hapticFeedback('error');
      Alert.alert("Error", "Failed to save settings");
    } finally {
      setSaving(false);
      progressAnim.setValue(0);
    }
  };

  const testApiKey = async () => {
    if (!geminiApiKey.trim()) {
      hapticFeedback('error');
      Alert.alert("Error", "Please enter an API key first");
      return;
    }

    hapticFeedback('medium');
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
      
      // Success animation and haptic
      hapticFeedback('success');
      Animated.timing(successAnim, {
        toValue: 1,
        duration: 600,
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
              duration: 400,
              useNativeDriver: true,
            }).start();
          }
        }]
      );
    } catch (error) {
      console.error("API key test error:", error);
      hapticFeedback('error');
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
    hapticFeedback('medium');
    Alert.alert(
      "🗑️ Remove API Key",
      "Are you sure you want to remove your Gemini API key? Translation will be disabled.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            hapticFeedback('light');
            setGeminiApiKey("");
          },
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

  const renderLanguageItem = ({ item, index }) => (
    <Animated.View
      style={[
        styles.languageItemContainer,
        {
          transform: [{
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [30, 0],
            })
          }],
          opacity: fadeAnim,
        }
      ]}
    >
      <TouchableOpacity
        style={[
          styles.languageItem,
          selectedLanguage === item.code && styles.selectedLanguageItem,
        ]}
        onPress={() => {
          hapticFeedback('light');
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
          <Animated.View style={{ transform: [{ scale: successAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.5, 1],
          })}] }}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
          </Animated.View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[
          styles.loadingContent,
          { transform: [{ rotate: pulseAnim.interpolate({
            inputRange: [1, 1.05],
            outputRange: ['0deg', '360deg'],
          })}] }
        ]}>
          <Ionicons name="settings" size={60} color="#fff" />
          <Text style={styles.loadingText}>Loading your settings...</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#667eea', '#764ba2', '#667eea']}
        style={StyleSheet.absoluteFill}
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
            onPress={() => {
              hapticFeedback('light');
              navigation.goBack();
            }}
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
          <BlurView intensity={20} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person-circle" size={24} color="#fff" />
              <Text style={styles.sectionTitle}>Profile</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Display Name</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={displayName}
                  onChangeText={(text) => {
                    hapticFeedback('light');
                    setDisplayName(text);
                  }}
                  placeholder="Enter display name"
                  placeholderTextColor="rgba(255,255,255,0.6)"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <View style={styles.readOnlyContainer}>
                <Text style={styles.readOnlyText}>@{profile?.username}</Text>
              </View>
            </View>
          </BlurView>

          {/* Language & Translation Section */}
          <BlurView intensity={20} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="language" size={24} color="#fff" />
              <Text style={styles.sectionTitle}>Language & Translation</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Preferred Language</Text>
              <TouchableOpacity
                style={styles.languageSelector}
                onPress={() => {
                  hapticFeedback('medium');
                  setShowLanguagePicker(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.languageSelectorText}>
                  {selectedLanguageData
                    ? `${selectedLanguageData.name} (${selectedLanguageData.native_name})`
                    : "Select Language"}
                </Text>
                <Ionicons name="chevron-down" size={20} color="rgba(255,255,255,0.7)" />
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
                    {testingApiKey ? (
                      <View style={styles.testButtonContent}>
                        <Animated.View
                          style={[
                            styles.loadingDot,
                            { opacity: pulseAnim },
                          ]}
                        />
                        <Text style={styles.testButtonText}>Testing...</Text>
                      </View>
                    ) : (
                      <View style={styles.testButtonContent}>
                        <Ionicons name="flash" size={16} color="#fff" />
                        <Text style={styles.testButtonText}>Test</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={geminiApiKey}
                  onChangeText={(text) => {
                    hapticFeedback('light');
                    setGeminiApiKey(text);
                  }}
                  placeholder="Enter your Gemini API key"
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

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
          </BlurView>

          {/* Progress Indicator */}
          {(saving || testingApiKey) && (
            <Animated.View style={styles.progressContainer}>
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
                {saving ? 'Saving your settings...' : 'Testing your API key...'}
              </Text>
            </Animated.View>
          )}

          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              saving && styles.saveButtonDisabled,
            ]}
            onPress={() => {
              animateButton(testButtonScale, saveSettings);
            }}
            disabled={saving}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={saving ? ['#666', '#888'] : ['#4CAF50', '#45a049']}
              style={styles.saveButtonGradient}
            >
              {saving ? (
                <View style={styles.saveButtonContent}>
                  <Animated.View
                    style={[
                      styles.loadingDot,
                      { opacity: pulseAnim },
                    ]}
                  />
                  <Text style={styles.saveButtonText}>Saving...</Text>
                </View>
              ) : (
                <View style={styles.saveButtonContent}>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Save Settings</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.ScrollView>

        {/* Language Picker Modal */}
        <Modal
          visible={showLanguagePicker}
          animationType="slide"
          presentationStyle="pageSheet"
          onShow={() => hapticFeedback('medium')}
        >
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.modalContainer}
          >
            <BlurView intensity={20} style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => {
                  hapticFeedback('light');
                  setShowLanguagePicker(false);
                }}
              >
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Select Language</Text>
              <View style={styles.modalSpacer} />
            </BlurView>

            <View style={styles.searchContainer}>
              <Ionicons
                name="search"
                size={20}
                color="rgba(255,255,255,0.7)"
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search languages..."
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={languageSearch}
                onChangeText={(text) => {
                  hapticFeedback('light');
                  setLanguageSearch(text);
                }}
              />
            </View>

            <FlatList
              data={filteredLanguages}
              renderItem={renderLanguageItem}
              keyExtractor={(item) => item.code}
              style={styles.languageList}
              showsVerticalScrollIndicator={false}
            />
          </LinearGradient>
        </Modal>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
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
  loadingContent: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  loadingText: {
    color: '#fff',
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
    textShadow: '0px 2px 4px rgba(0,0,0,0.3)',
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
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 12,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputContainer: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  input: {
    padding: 18,
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  readOnlyContainer: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    padding: 18,
  },
  readOnlyText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  languageSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  languageSelectorText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  helperText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
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
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  progressText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  saveButton: {
    borderRadius: 16,
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonGradient: {
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
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
    backgroundColor: 'rgba(0,0,0,0.7)',
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
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  modalCancel: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  modalSpacer: {
    width: 60,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 20,
    marginVertical: 16,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  languageList: {
    flex: 1,
  },
  languageItemContainer: {
    marginHorizontal: 20,
    marginVertical: 4,
  },
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  selectedLanguageItem: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderColor: '#4CAF50',
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  languageNative: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
});

export default ModernSettingsScreen;
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Animated,
  Dimensions,
  StatusBar,
  Image,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from 'expo-image-manipulator';
import Cropper from 'react-easy-crop';
import { useTheme } from "../contexts/ThemeContext";
import { supabase } from "../../utils/supabase";
import { uploadToR2, getR2Url } from "../utils/r2Storage";

const { width } = Dimensions.get('window');

const ProfileScreen = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [knownLanguages, setKnownLanguages] = useState([]);
  const [preferredLanguage, setPreferredLanguage] = useState("");
  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showPreferredLanguagePicker, setShowPreferredLanguagePicker] = useState(false);
  const [languageSearch, setLanguageSearch] = useState("");
  const [showCropModal, setShowCropModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  
  // Animation references
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const avatarScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadProfile();
    loadAvailableLanguages();
    
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

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUser(user);

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      setProfile(data);
      setDisplayName(data.display_name || "");
      setBio(data.bio || "");
      setAvatarUrl(data.avatar_url || "");
      setKnownLanguages(data.known_languages || []);
      setPreferredLanguage(data.preferred_language || "English");
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
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

  const pickImage = async () => {
    console.log('pickImage function called');
    try {
      // Request permissions
      console.log('Requesting permissions...');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('Permission status:', status);
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant camera roll permissions to change your profile picture.');
        return;
      }

      // Launch image picker without editing to get original image
      console.log('Launching image picker...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // We'll handle cropping ourselves
        quality: 1.0, // High quality for cropping
        selectionLimit: 1,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];

        // Check file size (limit to 5MB)
        const maxSizeInBytes = 5 * 1024 * 1024; // 5MB
        if (asset.fileSize && asset.fileSize > maxSizeInBytes) {
          Alert.alert(
            'File Too Large',
            'Please select an image smaller than 5MB. You can try reducing the image quality or choosing a different image.',
            [{ text: 'OK' }]
          );
          return;
        }

        // Show crop modal
        setSelectedImage(asset);
        setShowCropModal(true);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };


  const uploadProfilePicture = async (asset) => {
    console.log('uploadProfilePicture called with asset:', asset);
    setUploadingAvatar(true);
    animateButton(avatarScale);

    try {
      const fileName = `${profile.id}_${Date.now()}.jpg`;
      console.log('Uploading with filename:', fileName);

      // Convert asset URI to blob for upload
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, uint8Array, {
          contentType: asset.mimeType || 'image/jpeg',
          upsert: true
        });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        throw uploadError;
      }

      console.log('Upload completed, upload data:', uploadData);

      // Get public URL from Supabase Storage
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const newAvatarUrl = urlData.publicUrl;
      console.log('Generated avatar URL:', newAvatarUrl);

      // Update profile in database
      const { error } = await supabase
        .from("profiles")
        .update({
          avatar_url: newAvatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) {
        console.error('Database update error:', error);
        throw error;
      }

      console.log('Database updated successfully');
      setAvatarUrl(newAvatarUrl);
      console.log('Avatar URL state updated to:', newAvatarUrl);

      // Success animation - toast style
      Animated.sequence([
        Animated.timing(successAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(2000),
        Animated.timing(successAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

    } catch (error) {
      console.error('Error uploading avatar:', error);
      Alert.alert('Error', 'Failed to upload profile picture. Please try again.');
    } finally {
      setUploadingAvatar(false);
      console.log('Upload process finished, uploadingAvatar set to false');
    }
  };

  const showImagePicker = () => {
    console.log('showImagePicker called');
    // Direct call to pickImage to bypass Alert issues on web/Expo
    pickImage();
  };

  const onCropComplete = (croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleCropAndUpload = async () => {
    if (!selectedImage || !croppedAreaPixels) return;

    console.log('Cropping and uploading image...');
    console.log('Crop area:', croppedAreaPixels);

    // Create cropped image
    const croppedImage = await createCroppedImage(selectedImage.uri, croppedAreaPixels);

    setShowCropModal(false);
    await uploadProfilePicture(croppedImage);
    setSelectedImage(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const createCroppedImage = async (imageSrc, cropArea) => {
    try {
      console.log('Starting image crop with area:', cropArea);

      const result = await ImageManipulator.manipulateAsync(
        imageSrc,
        [
          {
            crop: {
              originX: cropArea.x,
              originY: cropArea.y,
              width: cropArea.width,
              height: cropArea.height,
            },
          },
        ],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      console.log('Crop successful:', result);

      return {
        uri: result.uri,
        width: result.width,
        height: result.height,
        type: 'image',
        mimeType: 'image/jpeg',
        fileName: `cropped_${Date.now()}.jpg`,
        fileSize: result.width * result.height * 0.5, // Estimate file size
      };
    } catch (error) {
      console.error('Error cropping image:', error);
      console.log('Using original image as fallback');
      // Fallback to original image if cropping fails
      return selectedImage;
    }
  };

  const removeProfilePicture = async () => {
    try {
      setUploadingAvatar(true);
      
      const { error } = await supabase
        .from("profiles")
        .update({
          avatar_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) throw error;

      setAvatarUrl("");
    } catch (error) {
      console.error('Error removing avatar:', error);
      Alert.alert('Error', 'Failed to remove profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const loadAvailableLanguages = async () => {
    try {
      const { data, error } = await supabase
        .from("language_codes")
        .select("*")
        .order("name");

      if (error) throw error;
      setAvailableLanguages(data || []);
    } catch (error) {
      console.error("Error loading languages:", error);
      // Fallback languages
      setAvailableLanguages([
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
        { code: "ar", name: "Arabic", native_name: "العربية" },
        { code: "hi", name: "Hindi", native_name: "हिन्दी" },
        { code: "ta", name: "Tamil", native_name: "தமிழ்" },
        { code: "te", name: "Telugu", native_name: "తెలుగు" },
        { code: "bn", name: "Bengali", native_name: "বাংলা" },
        { code: "ur", name: "Urdu", native_name: "اردو" },
      ]);
    }
  };

  const addLanguage = (languageName) => {
    if (languageName && !knownLanguages.includes(languageName)) {
      setKnownLanguages(prev => [...prev, languageName]);
      setShowLanguagePicker(false);
      setLanguageSearch("");
    }
  };

  const selectPreferredLanguage = (languageName) => {
    setPreferredLanguage(languageName);
    setShowPreferredLanguagePicker(false);
    setLanguageSearch("");
  };

  const removeLanguage = (languageToRemove) => {
    setKnownLanguages(prev => prev.filter(lang => lang !== languageToRemove));
  };

  const saveProfile = async () => {
    if (!profile) return;

    setSaving(true);
    
    // Start progress animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: false,
    }).start();

    try {
      const updateData = {
        display_name: displayName.trim() || profile.username,
        known_languages: knownLanguages,
        preferred_language: preferredLanguage,
        updated_at: new Date().toISOString(),
      };

      // Only include bio if it's supported (column exists)
      if (bio.trim() !== undefined) {
        updateData.bio = bio.trim();
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", profile.id);

      if (error) {
        // If bio column doesn't exist, try without it
        if (error.message?.includes('bio') || error.message?.includes('column')) {
          console.warn('Bio column may not exist, trying without bio...');
          const { error: retryError } = await supabase
            .from("profiles")
            .update({
              display_name: displayName.trim() || profile.username,
              updated_at: new Date().toISOString(),
            })
            .eq("id", profile.id);
          
          if (retryError) throw retryError;
          
          Alert.alert("⚠️ Partial Success", "Display name saved, but bio feature requires database update. Contact your developer to add the bio column.");
        } else {
          throw error;
        }
      }

      // Success animation - toast style
      Animated.sequence([
        Animated.timing(successAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(2000),
        Animated.timing(successAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
      await loadProfile();
    } catch (error) {
      console.error("Error saving profile:", error);
      Alert.alert("❌ Error", "Failed to save profile");
    } finally {
      setSaving(false);
      progressAnim.setValue(0);
    }
  };

  const styles = createStyles(theme);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardView}
        >
          <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
            <Ionicons name="person" size={60} color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.text }]}>
              Loading your profile...
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar 
        barStyle={isDark ? "light-content" : "dark-content"} 
        backgroundColor={theme.colors.background}
      />
      
      {/* Success Toast */}
      <Animated.View
        style={[
          styles.successToast,
          { backgroundColor: theme.colors.success },
          {
            opacity: successAnim,
            transform: [
              { 
                translateY: successAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-100, 0],
                })
              },
              { scale: successAnim }
            ],
          }
        ]}
        pointerEvents="none"
      >
        <Ionicons name="checkmark-circle" size={24} color="#fff" />
        <Text style={styles.successToastText}>Profile saved successfully!</Text>
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
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
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Profile</Text>
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
          {/* Profile Picture Section */}
          <View style={[styles.section, { backgroundColor: theme.colors.card }, theme.shadows.md]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="image" size={22} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Profile Picture</Text>
            </View>

            <View style={styles.avatarContainer}>
              <Animated.View style={{ transform: [{ scale: avatarScale }] }}>
                <TouchableOpacity
                  onPress={() => {
                    console.log('Avatar pressed!');
                    showImagePicker();
                  }}
                  onLongPress={() => {
                    if (avatarUrl) {
                      console.log('Long press - removing avatar');
                      removeProfilePicture();
                    }
                  }}
                  style={[
                    styles.avatarWrapper,
                    { borderColor: theme.colors.primary }
                  ]}
                  activeOpacity={0.8}
                  disabled={uploadingAvatar}
                >
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primary }]}>
                      <Text style={styles.avatarPlaceholderText}>
                        {profile?.display_name?.charAt(0).toUpperCase() || 
                         profile?.username?.charAt(0).toUpperCase() || "?"}
                      </Text>
                    </View>
                  )}
                  
                  {uploadingAvatar && (
                    <View style={styles.avatarOverlay}>
                      <ActivityIndicator size="large" color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
              
              <Text style={[styles.avatarHint, { color: theme.colors.textSecondary }]}>
                Tap to change your profile picture
              </Text>
              {avatarUrl && (
                <Text style={[styles.avatarSubHint, { color: theme.colors.textTertiary }]}>
                  Hold to remove current photo
                </Text>
              )}
            </View>
          </View>

          {/* Profile Information Section */}
          <View style={[styles.section, { backgroundColor: theme.colors.card }, theme.shadows.md]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person" size={22} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Profile Information</Text>
            </View>

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
                placeholder="Enter your display name"
                placeholderTextColor={theme.colors.inputPlaceholder}
                maxLength={50}
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
              <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>
                Your username cannot be changed
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Bio</Text>
              <TextInput
                style={[styles.textArea, { 
                  backgroundColor: theme.colors.inputBackground,
                  borderColor: theme.colors.inputBorder,
                  color: theme.colors.text,
                }]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell people a bit about yourself..."
                placeholderTextColor={theme.colors.inputPlaceholder}
                multiline
                numberOfLines={4}
                maxLength={200}
                textAlignVertical="top"
              />
              <Text style={[styles.charCount, { color: theme.colors.textTertiary }]}>
                {bio.length}/200
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Preferred Language</Text>
              <TouchableOpacity
                style={[styles.input, {
                  backgroundColor: theme.colors.inputBackground,
                  borderColor: theme.colors.inputBorder,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }]}
                onPress={() => setShowPreferredLanguagePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={[{
                  color: preferredLanguage ? theme.colors.text : theme.colors.inputPlaceholder,
                  fontSize: 16,
                  fontWeight: '500',
                }]}>
                  {preferredLanguage || "Select your main display language"}
                </Text>
                <Ionicons name="chevron-down" size={20} color={theme.colors.textTertiary} />
              </TouchableOpacity>
              <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>
                Messages in unknown languages will be translated to this language
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Known Languages</Text>
              <Text style={[styles.helperText, { color: theme.colors.textSecondary, marginBottom: 12 }]}>
                Add all languages you can understand (including your preferred language)
              </Text>
              
              {/* Add Language Button */}
              <TouchableOpacity
                style={[styles.addLanguageButton, {
                  backgroundColor: theme.colors.inputBackground,
                  borderColor: theme.colors.inputBorder,
                }]}
                onPress={() => setShowLanguagePicker(true)}
                activeOpacity={0.7}
              >
                <View style={styles.addLanguageContent}>
                  <Ionicons name="add-circle" size={20} color={theme.colors.primary} />
                  <Text style={[styles.addLanguageText, { color: theme.colors.text }]}>
                    Add a Language
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
              </TouchableOpacity>

              {/* Language Tags */}
              {knownLanguages.length > 0 && (
                <View style={styles.languageTagsContainer}>
                  {knownLanguages.map((language, index) => (
                    <View
                      key={index}
                      style={[styles.languageTag, { 
                        backgroundColor: theme.colors.primary + '20',
                        borderColor: theme.colors.primary + '40'
                      }]}
                    >
                      <Text style={[styles.languageTagText, { color: theme.colors.primary }]}>
                        {language}
                      </Text>
                      <TouchableOpacity
                        onPress={() => removeLanguage(language)}
                        style={styles.removeLanguageButton}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="close" size={16} color={theme.colors.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              
              {knownLanguages.length === 0 && (
                <Text style={[styles.emptyLanguagesText, { color: theme.colors.textTertiary }]}>
                  No languages added yet. Add your first language above!
                </Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Email</Text>
              <View style={[styles.readOnlyContainer, { 
                backgroundColor: theme.colors.divider,
                borderColor: theme.colors.border,
              }]}>
                <Text style={[styles.readOnlyText, { color: theme.colors.textSecondary }]}>
                  {user?.email || 'No email available'}
                </Text>
              </View>
              <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>
                Your email is managed through authentication settings
              </Text>
            </View>
          </View>

          {/* Account Stats Section */}
          <View style={[styles.section, { backgroundColor: theme.colors.card }, theme.shadows.md]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="analytics" size={22} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Account Info</Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Member since</Text>
                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                  {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Last updated</Text>
                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                  {profile?.updated_at ? new Date(profile.updated_at).toLocaleDateString() : 'Never'}
                </Text>
              </View>
            </View>
          </View>

          {/* Progress Indicator */}
          {saving && (
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
                💾 Saving your profile...
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
            onPress={() => animateButton(avatarScale, saveProfile)}
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
                {saving ? "Saving..." : "Save Profile"}
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
            <View style={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}>
              <View style={[styles.modalHeader, { 
                backgroundColor: theme.colors.card,
                borderBottomColor: theme.colors.border,
              }]}>
                <TouchableOpacity onPress={() => {
                  setShowLanguagePicker(false);
                  setLanguageSearch("");
                }}>
                  <Text style={[styles.modalCancel, { color: theme.colors.primary }]}>Cancel</Text>
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Add Language</Text>
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
                data={availableLanguages.filter(
                  (lang) =>
                    !knownLanguages.includes(lang.name) &&
                    (lang.name?.toLowerCase().includes(languageSearch.toLowerCase()) ||
                     lang.native_name?.toLowerCase().includes(languageSearch.toLowerCase()) ||
                     lang.code?.toLowerCase().includes(languageSearch.toLowerCase()))
                )}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.languagePickerItem, {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                    }]}
                    onPress={() => addLanguage(item.name)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.languagePickerInfo}>
                      <Text style={[styles.languagePickerName, { color: theme.colors.text }]}>
                        {item.name}
                      </Text>
                      <Text style={[styles.languagePickerNative, { color: theme.colors.textSecondary }]}>
                        {item.native_name}
                      </Text>
                    </View>
                    <Ionicons name="add" size={24} color={theme.colors.primary} />
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item.code}
                style={styles.languagePickerList}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 20 }}
                ListEmptyComponent={
                  <Text style={[styles.emptyLanguagesText, { color: theme.colors.textTertiary }]}>
                    {languageSearch ? 'No matching languages found' : 'All available languages are already added'}
                  </Text>
                }
              />
            </View>
          </Modal>

          {/* Preferred Language Picker Modal */}
          <Modal
            visible={showPreferredLanguagePicker}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowPreferredLanguagePicker(false)}
          >
            <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity 
                  onPress={() => setShowPreferredLanguagePicker(false)}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                  Select Preferred Language
                </Text>
                <View style={{ width: 24 }} />
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
                data={availableLanguages.filter(
                  (lang) =>
                    (lang.name?.toLowerCase().includes(languageSearch.toLowerCase()) ||
                     lang.native_name?.toLowerCase().includes(languageSearch.toLowerCase()) ||
                     lang.code?.toLowerCase().includes(languageSearch.toLowerCase()))
                )}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.languagePickerItem, {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                    }]}
                    onPress={() => selectPreferredLanguage(item.name)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.languagePickerInfo}>
                      <Text style={[styles.languagePickerName, { color: theme.colors.text }]}>
                        {item.name}
                      </Text>
                      <Text style={[styles.languagePickerNative, { color: theme.colors.textSecondary }]}>
                        {item.native_name}
                      </Text>
                    </View>
                    {preferredLanguage === item.name && (
                      <Ionicons name="checkmark" size={24} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item.code}
                style={styles.languagePickerList}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 20 }}
                ListEmptyComponent={
                  <Text style={[styles.emptyLanguagesText, { color: theme.colors.textTertiary }]}>
                    {languageSearch ? 'No matching languages found' : 'Loading languages...'}
                  </Text>
                }
              />
            </View>
          </Modal>

          {/* Circular Crop Modal */}
          <Modal
            visible={showCropModal}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={() => setShowCropModal(false)}
          >
            <View style={[styles.cropModalContainer, { backgroundColor: '#000000' }]}>
              <View style={[styles.cropHeader, { backgroundColor: 'rgba(0,0,0,0.8)' }]}>
                <TouchableOpacity
                  onPress={() => setShowCropModal(false)}
                  style={[styles.cropButton, styles.cropCancelButton]}
                >
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                  <Text style={[styles.cropButtonText, { color: '#FFFFFF' }]}>Cancel</Text>
                </TouchableOpacity>

                <View style={styles.cropTitleContainer}>
                  <Text style={[styles.cropTitle, { color: '#FFFFFF' }]}>
                    Crop Photo
                  </Text>
                  <Text style={[styles.cropSubtitle, { color: '#CCCCCC' }]}>
                    Move and scale to crop
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleCropAndUpload}
                  style={[styles.cropButton, styles.cropDoneButton, { backgroundColor: theme.colors.primary }]}
                  disabled={!croppedAreaPixels}
                >
                  <Ionicons name="checkmark" size={24} color="#FFFFFF" />
                  <Text style={[styles.cropButtonText, { color: '#FFFFFF' }]}>Done</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.cropImageContainer}>
                {selectedImage && (
                  <Cropper
                    image={selectedImage.uri}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    cropShape="round"
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                    style={{
                      containerStyle: { backgroundColor: '#000000' },
                      cropAreaStyle: { border: '2px solid #FFFFFF' }
                    }}
                  />
                )}
              </View>

              <View style={styles.cropInstructions}>
                <View style={styles.cropControlsRow}>
                  <View style={styles.cropControl}>
                    <Ionicons name="move" size={20} color="#FFFFFF" />
                    <Text style={[styles.cropControlText, { color: '#FFFFFF' }]}>Drag to move</Text>
                  </View>
                  <View style={styles.cropControl}>
                    <Ionicons name="expand" size={20} color="#FFFFFF" />
                    <Text style={[styles.cropControlText, { color: '#FFFFFF' }]}>Pinch to zoom</Text>
                  </View>
                </View>
                <Text style={[styles.cropHelpText, { color: '#CCCCCC' }]}>
                  Position your photo within the circle for your avatar
                </Text>
              </View>
            </View>
          </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  loadingText: {
    fontSize: 18,
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
  avatarContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatarWrapper: {
    position: 'relative',
    borderWidth: 3,
    borderRadius: 75,
    marginBottom: 12,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '600',
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditIcon: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarHint: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  avatarSubHint: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  textArea: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    fontSize: 16,
    fontWeight: '500',
    minHeight: 100,
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
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
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
  successToast: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  successToastText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
  },
  addLanguageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    marginBottom: 16,
  },
  addLanguageContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addLanguageText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
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
  languagePickerList: {
    flex: 1,
  },
  languagePickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  languagePickerInfo: {
    flex: 1,
  },
  languagePickerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  languagePickerNative: {
    fontSize: 14,
    marginTop: 2,
  },
  languageTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  languageTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  languageTagText: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 6,
  },
  removeLanguageButton: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyLanguagesText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  // Crop Modal Styles
  cropModalContainer: {
    flex: 1,
  },
  cropHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
  },
  cropButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
    minWidth: 80,
  },
  cropCancelButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  cropDoneButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  cropButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cropTitleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  cropTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  cropSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 2,
  },
  cropImageContainer: {
    flex: 1,
    position: 'relative',
  },
  cropInstructions: {
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  cropControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  cropControl: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  cropControlText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  cropHelpText: {
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default ProfileScreen;
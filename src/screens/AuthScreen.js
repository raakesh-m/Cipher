import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../utils/supabase";
import { useTheme } from "../contexts/ThemeContext";

export default function AuthScreen() {
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (isSignUp && !username) {
      Alert.alert("Error", "Username is required for sign up");
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        // Check if username already exists
        const { data: existingUser } = await supabase
          .from("profiles")
          .select("username")
          .eq("username", username.toLowerCase())
          .maybeSingle();

        if (existingUser) {
          Alert.alert("Error", "Username already taken");
          setLoading(false);
          return;
        }

        // Sign up
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username.toLowerCase(),
              display_name: displayName || username,
            },
          },
        });

        if (error) throw error;

        Alert.alert(
          "Success",
          "Account created! Please check your email to verify your account."
        );
      } else {
        // Sign in
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Save keep signed in preference
        await AsyncStorage.setItem("keepSignedIn", keepSignedIn.toString());
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[theme.colors.primary + '20', theme.colors.background]}
      style={styles.gradient}
    >
      <SafeAreaView style={[
        styles.container,
        { backgroundColor: 'transparent' }
      ]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <View style={[
                styles.logoContainer,
                { backgroundColor: theme.colors.primary }
              ]}>
                <Ionicons name="shield-checkmark" size={32} color="#fff" />
              </View>
              <Text style={[
                styles.title,
                { color: theme.colors.text }
              ]}>Cipher</Text>
              <Text style={[
                styles.subtitle,
                { color: theme.colors.textSecondary }
              ]}>
                {isSignUp ? "Create your account" : "Welcome back"}
              </Text>
            </View>

            <View style={[
              styles.form,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                ...theme.shadows.lg,
              },
            ]}>
              <View style={styles.inputGroup}>
                <Text style={[
                  styles.inputLabel,
                  { color: theme.colors.text }
                ]}>Email Address</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.colors.inputBackground,
                      borderColor: theme.colors.inputBorder,
                      color: theme.colors.text,
                    },
                  ]}
                  placeholder="Enter your email"
                  placeholderTextColor={theme.colors.inputPlaceholder}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[
                  styles.inputLabel,
                  { color: theme.colors.text }
                ]}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.passwordInput,
                      {
                        backgroundColor: theme.colors.inputBackground,
                        borderColor: theme.colors.inputBorder,
                        color: theme.colors.text,
                      },
                    ]}
                    placeholder="Enter your password"
                    placeholderTextColor={theme.colors.inputPlaceholder}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                  />
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons 
                      name={showPassword ? "eye-off" : "eye"} 
                      size={20} 
                      color={theme.colors.textTertiary} 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {isSignUp && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={[
                      styles.inputLabel,
                      { color: theme.colors.text }
                    ]}>Username</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.colors.inputBackground,
                          borderColor: theme.colors.inputBorder,
                          color: theme.colors.text,
                        },
                      ]}
                      placeholder="Choose a username"
                      placeholderTextColor={theme.colors.inputPlaceholder}
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      autoComplete="username"
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={[
                      styles.inputLabel,
                      { color: theme.colors.text }
                    ]}>Display Name (Optional)</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.colors.inputBackground,
                          borderColor: theme.colors.inputBorder,
                          color: theme.colors.text,
                        },
                      ]}
                      placeholder="How should others see your name?"
                      placeholderTextColor={theme.colors.inputPlaceholder}
                      value={displayName}
                      onChangeText={setDisplayName}
                      autoComplete="name"
                    />
                  </View>
                </>
              )}

              {!isSignUp && (
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setKeepSignedIn(!keepSignedIn)}
                >
                  <View style={[
                    styles.checkbox,
                    {
                      borderColor: theme.colors.inputBorder,
                      backgroundColor: keepSignedIn 
                        ? theme.colors.primary 
                        : theme.colors.inputBackground,
                    },
                  ]}>
                    {keepSignedIn && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </View>
                  <Text style={[
                    styles.checkboxLabel,
                    { color: theme.colors.text }
                  ]}>
                    Keep me signed in
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.button,
                  {
                    backgroundColor: loading 
                      ? theme.colors.textTertiary 
                      : theme.colors.primary,
                    ...theme.shadows.md,
                  },
                ]}
                onPress={handleAuth}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size={20} color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>
                    {isSignUp ? "Create Account" : "Sign In"}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchButton}
                onPress={() => setIsSignUp(!isSignUp)}
                disabled={loading}
              >
                <Text style={[
                  styles.switchText,
                  { color: theme.colors.primary }
                ]}>
                  {isSignUp
                    ? "Already have an account? Sign In"
                    : "Don't have an account? Sign Up"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: "500",
  },
  form: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 4,
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    fontWeight: "500",
  },
  passwordContainer: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 48,
  },
  passwordToggle: {
    position: "absolute",
    right: 16,
    top: 14,
    padding: 4,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    minHeight: 52,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  switchButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  switchText: {
    fontSize: 15,
    fontWeight: "500",
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
});

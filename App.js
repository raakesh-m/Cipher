import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { supabase } from "./utils/supabase";
import { ThemeProvider, useTheme } from "./src/contexts/ThemeContext";

// Import screens
import AuthScreen from "./src/screens/AuthScreen";
import ChatListScreen from "./src/screens/ChatListScreen";
import ChatScreen from "./src/screens/ChatScreen";
import ThemedSettingsScreen from "./src/screens/ThemedSettingsScreen";
import UserSearchScreen from "./src/screens/UserSearchScreen";
import MediaViewerScreen from "./src/screens/MediaViewerScreen";

const Stack = createStackNavigator();

function AppContent() {
  const { theme, isDark } = useTheme();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setLoading(false);
      } catch (error) {
        console.error("Error initializing auth:", error);
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth event:", event, "Session:", !!session);
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: "center", 
        alignItems: "center",
        backgroundColor: theme.colors.background,
      }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style={isDark ? "light" : "dark"} translucent={false} backgroundColor={theme.colors.background} />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <>
            <Stack.Screen name="ChatList" component={ChatListScreen} />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={{
                headerShown: true,
                headerBackTitleVisible: false,
                headerTintColor: theme.colors.primary,
                headerStyle: { 
                  backgroundColor: theme.colors.background,
                },
                headerTitleStyle: {
                  color: theme.colors.text,
                },
              }}
            />
            <Stack.Screen
              name="Settings"
              component={ThemedSettingsScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="UserSearch"
              component={UserSearchScreen}
              options={{
                headerShown: true,
                title: "New Chat",
                headerTintColor: theme.colors.primary,
                headerStyle: { 
                  backgroundColor: theme.colors.background,
                },
                headerTitleStyle: {
                  color: theme.colors.text,
                },
              }}
            />
            <Stack.Screen
              name="MediaViewer"
              component={MediaViewerScreen}
              options={{
                headerShown: true,
                headerBackTitleVisible: false,
                headerTintColor: "#fff",
                headerStyle: { backgroundColor: "#000" },
              }}
            />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

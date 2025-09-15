import React, { useState, useEffect, useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { supabase } from "./utils/supabase";
import { ThemeProvider, useTheme } from "./src/contexts/ThemeContext";
import { 
  registerForPushNotificationsAsync,
  addNotificationResponseListener,
  addNotificationReceivedListener,
  clearBadge,
} from "./src/services/notificationService";

// Import screens
import AuthScreen from "./src/screens/AuthScreen";
import ChatListScreen from "./src/screens/ChatListScreen";
import ChatScreen from "./src/screens/ChatScreen";
import ThemedSettingsScreen from "./src/screens/ThemedSettingsScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import UserSearchScreen from "./src/screens/UserSearchScreen";
import MediaViewerScreen from "./src/screens/MediaViewerScreen";

const Stack = createStackNavigator();

function AppContent() {
  const { theme } = useTheme();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigationRef = useRef();

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setLoading(false);

        // Initialize notifications if user is logged in
        if (session) {
          await initializeNotifications();
        }
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
      
      if (session && event === 'SIGNED_IN') {
        await initializeNotifications();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const initializeNotifications = async () => {
    try {
      // Register for push notifications
      await registerForPushNotificationsAsync();

      // Handle notification taps (when app is closed/background)
      const responseListener = addNotificationResponseListener(response => {
        const { screen, chatId, otherUser } = response.notification.request.content.data;
        
        if (screen === 'Chat' && chatId && otherUser && navigationRef.current) {
          navigationRef.current.navigate('Chat', { chatId, otherUser });
        }
      });

      // Handle notifications received while app is in foreground
      const receivedListener = addNotificationReceivedListener(notification => {
        // Clear badge when notification is received in foreground
        clearBadge();
      });

      return () => {
        responseListener && responseListener.remove();
        receivedListener && receivedListener.remove();
      };
    } catch (error) {
      console.error('Error initializing notifications:', error);
    }
  };

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
      <NavigationContainer ref={navigationRef}>
        <StatusBar style="dark" translucent={false} backgroundColor={theme.colors.surface} />
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
                  backgroundColor: theme.colors.surface,
                },
                headerTitleStyle: {
                  color: theme.colors.textPrimary,
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
              name="Profile"
              component={ProfileScreen}
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
                  backgroundColor: theme.colors.surface,
                },
                headerTitleStyle: {
                  color: theme.colors.textPrimary,
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

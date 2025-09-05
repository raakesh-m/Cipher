import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { supabase } from "./utils/supabase";

// Import screens
import AuthScreen from "./src/screens/AuthScreen";
import ChatListScreen from "./src/screens/ChatListScreen";
import ChatScreen from "./src/screens/ChatScreen";
import ModernSettingsScreen from "./src/screens/ModernSettingsScreen";
import UserSearchScreen from "./src/screens/UserSearchScreen";
import MediaViewerScreen from "./src/screens/MediaViewerScreen";

const Stack = createStackNavigator();

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
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
                headerTintColor: "#007AFF",
              }}
            />
            <Stack.Screen
              name="Settings"
              component={ModernSettingsScreen}
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
                headerTintColor: "#007AFF",
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
  );
}

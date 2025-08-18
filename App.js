import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

/**
 * Simple in‑memory chat for the Cipher messaging app.
 *
 * This app demonstrates a minimal messaging UI built with React Native
 * and Expo. Messages are stored in a local state array, and new
 * messages are appended when the user presses the send button. In a
 * production app you would connect this to a backend service to
 * persist and sync messages across devices.
 */
export default function App() {
  const [messages, setMessages] = useState([
    { id: '1', text: 'Welcome to Cipher! Your messages are secure.' },
  ]);
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed) {
      return;
    }
    const newMessage = {
      id: Date.now().toString(),
      text: trimmed,
    };
    setMessages((prev) => [newMessage, ...prev]);
    setInputText('');
  };

  const renderItem = ({ item }) => (
    <View style={styles.messageBubble}>
      <Text style={styles.messageText}>{item.text}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.messagesContainer}>
        <FlatList
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          inverted
        />
      </View>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message…"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  messageBubble: {
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    alignSelf: 'flex-start',
    // Simple drop shadow on iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    // Elevation for Android
    elevation: 1,
  },
  messageText: {
    fontSize: 16,
    color: '#333333',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderTopWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#ffffff',
  },
  input: {
    flex: 1,
    height: 40,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    marginRight: 8,
    backgroundColor: '#fafafa',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
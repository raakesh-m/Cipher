import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import messageStatusService, { MessageStatus } from '../services/messageStatusService';

const MessageBubble = ({ 
  message, 
  isOwnMessage, 
  onRetry, 
  onLongPress,
  showTimestamp = false 
}) => {
  const { theme } = useTheme();

  const getStatusIcon = () => {
    if (!isOwnMessage) return null;
    
    switch (message.status) {
      case MessageStatus.SENDING:
        return <Ionicons name="time-outline" size={14} color={theme.colors.textTertiary} />;
      case MessageStatus.SENT:
        return <Ionicons name="checkmark" size={14} color={theme.colors.textSecondary} />;
      case MessageStatus.DELIVERED:
        return (
          <View style={styles.doubleCheckmark}>
            <Ionicons name="checkmark" size={14} color={theme.colors.textSecondary} />
            <Ionicons name="checkmark" size={14} color={theme.colors.textSecondary} style={styles.secondCheck} />
          </View>
        );
      case MessageStatus.READ:
        return (
          <View style={styles.doubleCheckmark}>
            <Ionicons name="checkmark" size={14} color={theme.colors.primary} />
            <Ionicons name="checkmark" size={14} color={theme.colors.primary} style={styles.secondCheck} />
          </View>
        );
      case MessageStatus.FAILED:
        return (
          <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
            <Ionicons name="alert-circle" size={14} color={theme.colors.error} />
          </TouchableOpacity>
        );
      default:
        return null;
    }
  };

  const getMessageTime = () => {
    if (!message.created_at) return '';
    
    const date = new Date(message.created_at);
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const bubbleStyle = [
    styles.bubble,
    isOwnMessage ? [
      styles.ownBubble,
      { backgroundColor: theme.colors.primary }
    ] : [
      styles.otherBubble,
      { 
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border
      }
    ],
    message.status === MessageStatus.FAILED && styles.failedBubble
  ];

  const textStyle = [
    styles.messageText,
    {
      color: isOwnMessage ? '#FFFFFF' : theme.colors.text
    }
  ];

  return (
    <View style={[
      styles.messageContainer,
      isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
    ]}>
      <TouchableOpacity
        onLongPress={onLongPress}
        style={bubbleStyle}
        activeOpacity={0.8}
      >
        <Text style={textStyle}>
          {message.content_translated || message.content_original || message.content || ''}
        </Text>
        
        <View style={styles.messageFooter}>
          <Text style={[
            styles.timeText,
            { color: isOwnMessage ? 'rgba(255,255,255,0.7)' : theme.colors.textTertiary }
          ]}>
            {getMessageTime()}
          </Text>
          
          {getStatusIcon()}
        </View>
      </TouchableOpacity>
      
      {showTimestamp && (
        <View style={styles.timestampContainer}>
          <Text style={[styles.timestamp, { color: theme.colors.textTertiary }]}>
            {new Date(message.created_at).toLocaleDateString()} {getMessageTime()}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  messageContainer: {
    marginVertical: 2,
    paddingHorizontal: 16,
  },
  ownMessageContainer: {
    alignItems: 'flex-end',
  },
  otherMessageContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 60,
  },
  ownBubble: {
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  failedBubble: {
    opacity: 0.6,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  doubleCheckmark: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secondCheck: {
    marginLeft: -8,
  },
  retryButton: {
    padding: 2,
  },
  timestampContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  timestamp: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default MessageBubble;
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
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
  const [showingOriginal, setShowingOriginal] = useState(false);

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

  // Determine what content to show based on context
  const getDisplayContent = () => {
    // For own messages (sent): always show original
    if (isOwnMessage) {
      return message.content_original || message.content || '';
    }

    // For received messages: show translated if available, original if requested
    if (showingOriginal) {
      return message.content_original || message.content || '';
    }

    // Show translated version for recipient if available, otherwise original
    return message.content_translated || message.content_original || message.content || '';
  };

  // Check if message was translated (only relevant for received messages)
  const isTranslatedMessage = () => {
    return !isOwnMessage && message.was_translated && message.content_translated;
  };

  // Handle long press for received messages to toggle original/translated
  const handleLongPress = () => {
    if (!isOwnMessage && message.content_original && message.content_translated) {
      // Show options to view original or call custom long press handler
      Alert.alert(
        'Message Options',
        isTranslatedMessage() ? 'This message was translated' : 'Message actions',
        [
          ...(isTranslatedMessage() ? [{
            text: showingOriginal ? 'Show Translation' : 'Show Original',
            onPress: () => setShowingOriginal(!showingOriginal)
          }] : []),
          {
            text: 'Copy Text',
            onPress: () => {
              // Could implement clipboard copy here
              if (onLongPress) onLongPress();
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } else if (onLongPress) {
      onLongPress();
    }
  };

  const bubbleStyle = [
    styles.bubble,
    isOwnMessage ? [
      styles.ownBubble,
      { backgroundColor: theme.colors.outgoingBubble }
    ] : [
      styles.otherBubble,
      {
        backgroundColor: isTranslatedMessage()
          ? theme.colors.translatedBackground || theme.colors.incomingBubble
          : theme.colors.incomingBubble,
        borderColor: isTranslatedMessage()
          ? theme.colors.translatedBorder || theme.colors.primary
          : 'transparent',
        borderWidth: isTranslatedMessage() ? 2 : 0
      }
    ],
    message.status === MessageStatus.FAILED && styles.failedBubble
  ];

  const textStyle = [
    styles.messageText,
    {
      color: isOwnMessage ? theme.colors.outgoingText : theme.colors.incomingText
    }
  ];

  return (
    <View style={[
      styles.messageContainer,
      isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
    ]}>
      <TouchableOpacity
        onLongPress={handleLongPress}
        style={bubbleStyle}
        activeOpacity={0.8}
      >
        {/* Translation indicator for received messages */}
        {isTranslatedMessage() && (
          <View style={styles.translationIndicator}>
            <Ionicons 
              name="language" 
              size={12} 
              color={theme.colors.primary} 
              style={{ marginRight: 4 }}
            />
            <Text style={[
              styles.translationText,
              { color: theme.colors.primary }
            ]}>
              {showingOriginal ? 'Original' : 'Translated'}
            </Text>
          </View>
        )}

        {/* Render file attachment if message type is file */}
        {message.message_type === 'file' ? (
          <View style={styles.fileAttachment}>
            <View style={[styles.fileIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="document" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.fileInfo}>
              <Text style={[styles.fileName, { color: isOwnMessage ? theme.colors.outgoingText : theme.colors.incomingText }]}>
                {message.file_name || 'Document.pdf'}
              </Text>
              <Text style={[styles.fileSize, { color: isOwnMessage ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.7)' }]}>
                {message.file_size || '269.18 KB'}
              </Text>
            </View>
            <TouchableOpacity style={styles.downloadButton}>
              <Ionicons name="download" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={textStyle}>
            {getDisplayContent()}
          </Text>
        )}
        
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
  translationIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  translationText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fileAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    fontWeight: '400',
  },
  downloadButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});

export default MessageBubble;
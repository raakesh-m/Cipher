import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import messageStatusService, { MessageStatus } from '../services/messageStatusService';
import VoiceMessage from './VoiceMessage';

const MessageBubble = ({
  message,
  isOwnMessage,
  onRetry,
  onLongPress,
  showTimestamp = false,
  isGroupChat = false
}) => {
  const { theme } = useTheme();
  const [showingOriginal, setShowingOriginal] = useState(false);

  // Get sender display name for group chats
  const getSenderName = () => {
    if (!isGroupChat || isOwnMessage) return null;

    const senderProfile = message.profiles;
    if (!senderProfile) return 'Unknown';

    return senderProfile.display_name || senderProfile.username || 'Unknown';
  };

  // Get initials for avatar
  const getInitials = (name) => {
    if (!name) return "?";
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };

  const getStatusIcon = () => {
    if (!isOwnMessage) return null;

    switch (message.status) {
      case MessageStatus.SENDING:
        // Clock icon while message is being sent
        return <Ionicons name="time-outline" size={14} color={theme.colors.textTertiary} />;

      case MessageStatus.SENT:
        // Single gray checkmark - message sent to server
        return <Ionicons name="checkmark" size={14} color={theme.colors.textSecondary} />;

      case MessageStatus.DELIVERED:
        // Double gray checkmarks - delivered to recipient's device
        return (
          <View style={styles.doubleCheckmark}>
            <Ionicons name="checkmark" size={14} color={theme.colors.textSecondary} />
            <Ionicons name="checkmark" size={14} color={theme.colors.textSecondary} style={styles.secondCheck} />
          </View>
        );

      case MessageStatus.READ:
        // Double blue checkmarks - read by recipient
        return (
          <View style={styles.doubleCheckmark}>
            <Ionicons name="checkmark" size={14} color={theme.colors.primary} />
            <Ionicons name="checkmark" size={14} color={theme.colors.primary} style={styles.secondCheck} />
          </View>
        );

      case MessageStatus.FAILED:
        // Red alert icon for failed messages
        return (
          <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
            <Ionicons name="alert-circle" size={14} color={theme.colors.error} />
          </TouchableOpacity>
        );

      default:
        // Fallback to sent status
        return <Ionicons name="checkmark" size={14} color={theme.colors.textSecondary} />;
    }
  };

  const getMessageTime = () => {
    if (!message.created_at) return '';

    try {
      const date = new Date(message.created_at);
      if (isNaN(date.getTime())) {
        console.warn('Invalid date for message:', message.created_at);
        return '';
      }
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      console.error('Error formatting message time:', error);
      return '';
    }
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

  const senderName = getSenderName();
  const senderProfile = message.profiles;

  return (
    <View style={[
      styles.messageContainer,
      isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
    ]}>
      {/* Sender info for group chats (only for other people's messages) */}
      {isGroupChat && !isOwnMessage && senderName && (
        <View style={styles.senderInfoContainer}>
          <View style={[styles.senderAvatar, { backgroundColor: theme.colors.primary }]}>
            {senderProfile?.avatar_url ? (
              <Image
                source={{ uri: senderProfile.avatar_url }}
                style={styles.senderAvatarImage}
              />
            ) : (
              <Text style={styles.senderAvatarText}>
                {getInitials(senderName)}
              </Text>
            )}
          </View>
          <Text style={[styles.senderName, { color: theme.colors.textSecondary }]}>
            {senderName}
          </Text>
        </View>
      )}

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

        {/* Render content based on message type */}
        {message.message_type === 'voice' ? (
          <VoiceMessage
            voiceUrl={message.voice_url}
            duration={message.voice_duration}
            isOwnMessage={isOwnMessage}
            onPlayStateChange={(isPlaying) => {
              // Optional: Could implement global audio management here
            }}
          />
        ) : message.message_type === 'file' ? (
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
            {message.created_at ? (() => {
              try {
                const date = new Date(message.created_at);
                if (isNaN(date.getTime())) return 'Invalid Date';
                return `${date.toLocaleDateString()} ${getMessageTime()}`;
              } catch (error) {
                return 'Invalid Date';
              }
            })() : 'No Date'}
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
  senderInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    marginLeft: 4,
  },
  senderAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    overflow: 'hidden',
  },
  senderAvatarImage: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  senderAvatarText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
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
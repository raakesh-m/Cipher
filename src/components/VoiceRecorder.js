import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../contexts/ThemeContext';

export default function VoiceRecorder({
  onRecordingComplete,
  onCancel,
  maxDuration = 300000, // 5 minutes
}) {
  const { theme } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const recordingRef = useRef(null);
  const timerRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (isRecording && !isPaused) {
      startPulseAnimation();
      startTimer();
    } else {
      stopPulseAnimation();
      stopTimer();
    }
  }, [isRecording, isPaused]);

  const requestPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant microphone permission to record voice messages.',
          [{ text: 'OK' }]
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  };

  const startPulseAnimation = () => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (isRecording && !isPaused) {
          pulse();
        }
      });
    };
    pulse();
  };

  const stopPulseAnimation = () => {
    pulseAnim.setValue(1);
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setRecordingDuration((prev) => {
        const newDuration = prev + 1000;
        if (newDuration >= maxDuration) {
          stopRecording();
          return maxDuration;
        }
        return newDuration;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const cleanup = async () => {
    stopTimer();
    if (recordingRef.current) {
      try {
        const status = await recordingRef.current.getStatusAsync();
        if (status.canRecord || status.isRecording) {
          await recordingRef.current.stopAndUnloadAsync();
        }
      } catch (error) {
        // Ignore "already unloaded" errors
        if (!error.message.includes('already been unloaded')) {
          console.error('Error cleaning up recording:', error);
        }
      }
      recordingRef.current = null;
    }
    setIsRecording(false);
    setIsPaused(false);
    setRecordingDuration(0);
  };

  const startRecording = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });

      recordingRef.current = recording;
      await recording.startAsync();
      setIsRecording(true);
      setRecordingDuration(0);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const pauseRecording = async () => {
    try {
      if (recordingRef.current && isRecording) {
        await recordingRef.current.pauseAsync();
        setIsPaused(true);
      }
    } catch (error) {
      console.error('Error pausing recording:', error);
    }
  };

  const resumeRecording = async () => {
    try {
      if (recordingRef.current && isPaused) {
        await recordingRef.current.startAsync();
        setIsPaused(false);
      }
    } catch (error) {
      console.error('Error resuming recording:', error);
    }
  };

  const stopRecording = async () => {
    try {
      if (!recordingRef.current) return;

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();

      if (uri) {
        if (Platform.OS === 'web') {
          // On web, we can't use FileSystem, so just use estimated size
          onRecordingComplete({
            uri,
            duration: recordingDuration,
            size: Math.floor(recordingDuration * 16), // Estimate: ~16 bytes per ms
          });
        } else {
          // On native platforms, get actual file info
          const fileInfo = await FileSystem.getInfoAsync(uri);

          if (fileInfo.exists) {
            onRecordingComplete({
              uri,
              duration: recordingDuration,
              size: fileInfo.size,
            });
          } else {
            throw new Error('Recording file not found');
          }
        }
      }

      await cleanup();
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Error', 'Failed to save recording. Please try again.');
      await cleanup();
    }
  };

  const cancelRecording = async () => {
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();

        // Try to delete the file (only on native platforms)
        if (Platform.OS !== 'web') {
          const uri = recordingRef.current.getURI();
          if (uri) {
            try {
              await FileSystem.deleteAsync(uri);
            } catch (deleteError) {
              console.error('Error deleting cancelled recording:', deleteError);
            }
          }
        }
      }

      await cleanup();
      onCancel();
    } catch (error) {
      console.error('Error cancelling recording:', error);
      await cleanup();
      onCancel();
    }
  };

  const formatTime = (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isRecording) {
    return (
      <TouchableOpacity
        style={[styles.micButton, { backgroundColor: theme.colors.primary }]}
        onPress={startRecording}
      >
        <Ionicons name="mic" size={20} color="#fff" />
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.recordingContainer, { backgroundColor: theme.colors.surface }]}>
      {/* Cancel Button */}
      <TouchableOpacity
        style={styles.cancelButton}
        onPress={cancelRecording}
      >
        <Ionicons name="close" size={20} color={theme.colors.error || '#FF3B30'} />
      </TouchableOpacity>

      {/* Recording Info */}
      <View style={styles.recordingInfo}>
        <Animated.View
          style={[
            styles.recordingIndicator,
            {
              backgroundColor: theme.colors.error || '#FF3B30',
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
        <Text style={[styles.recordingText, { color: theme.colors.textPrimary }]}>
          {formatTime(recordingDuration)}
        </Text>
      </View>

      {/* Pause/Resume Button */}
      <TouchableOpacity
        style={[styles.pauseButton, { backgroundColor: theme.colors.border }]}
        onPress={isPaused ? resumeRecording : pauseRecording}
      >
        <Ionicons
          name={isPaused ? "play" : "pause"}
          size={16}
          color={theme.colors.textPrimary}
        />
      </TouchableOpacity>

      {/* Send Button */}
      <TouchableOpacity
        style={[styles.sendButton, { backgroundColor: theme.colors.primary }]}
        onPress={stopRecording}
        disabled={recordingDuration < 1000} // Minimum 1 second
      >
        <Ionicons name="send" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  micButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 25,
    gap: 12,
  },
  cancelButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recordingText: {
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  pauseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
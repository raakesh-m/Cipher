import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../contexts/ThemeContext';

export default function VoiceMessage({
  voiceUrl,
  duration,
  isOwnMessage,
  onPlayStateChange,
}) {
  // console.log('VoiceMessage received props:', { voiceUrl, duration, isOwnMessage });
  const { theme } = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [soundDuration, setSoundDuration] = useState(duration || 0);
  const soundRef = useRef(null);
  const positionInterval = useRef(null);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      if (positionInterval.current) {
        clearInterval(positionInterval.current);
      }
      // Clean up temp files on mobile
      if (Platform.OS !== 'web') {
        const tempDir = FileSystem.cacheDirectory + 'voice_temp/';
        FileSystem.getInfoAsync(tempDir).then((info) => {
          if (info.exists) {
            FileSystem.deleteAsync(tempDir, { idempotent: true }).catch(() => {
              // Ignore cleanup errors
            });
          }
        }).catch(() => {
          // Ignore cleanup errors
        });
      }
    };
  }, []);

  const formatTime = (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Convert data URL to temporary file for mobile platforms
  const dataUrlToTempFile = async (dataUrl) => {
    try {
      const tempDir = FileSystem.cacheDirectory + 'voice_temp/';
      await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });

      // Determine file extension based on data URL MIME type
      let fileExtension = '.m4a'; // default
      if (dataUrl.includes('audio/webm')) {
        fileExtension = '.webm';
      } else if (dataUrl.includes('audio/mp4') || dataUrl.includes('audio/m4a')) {
        fileExtension = '.m4a';
      } else if (dataUrl.includes('audio/wav')) {
        fileExtension = '.wav';
      }

      const tempFilePath = tempDir + `voice_${Date.now()}${fileExtension}`;

      // Extract base64 data from data URL
      const base64Data = dataUrl.split(',')[1];
      if (!base64Data) {
        throw new Error('Invalid data URL format - no base64 data found');
      }

      await FileSystem.writeAsStringAsync(tempFilePath, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Verify the file was created
      const fileInfo = await FileSystem.getInfoAsync(tempFilePath);
      if (!fileInfo.exists) {
        throw new Error('Failed to create temp file');
      }

      return tempFilePath;
    } catch (error) {
      console.error('Error creating temp file:', error);
      throw error;
    }
  };

  const loadSound = async () => {
    try {
      setIsLoading(true);

      if (!voiceUrl) {
        throw new Error('No voice URL provided');
      }

      // Handle different URL types
      let audioUrl = voiceUrl;

      if (voiceUrl.startsWith('data:')) {
        // Data URL handling
        if (Platform.OS === 'web') {
          // Web can handle data URLs directly
          audioUrl = voiceUrl;
        } else {
          // Mobile needs data URLs converted to temp files
          audioUrl = await dataUrlToTempFile(voiceUrl);
        }
      } else if (voiceUrl.startsWith('blob:')) {
        // Blob URL - use as-is (works better on web)
        audioUrl = voiceUrl;
      } else if (voiceUrl.startsWith('http')) {
        // Full URL - use as-is
        audioUrl = voiceUrl;
      } else if (voiceUrl.startsWith('file://')) {
        // File URI - on Android, we need to convert to a format that Audio can handle
        if (Platform.OS === 'android') {
          // For Android, first check if the file exists
          try {
            const fileInfo = await FileSystem.getInfoAsync(voiceUrl);
            if (!fileInfo.exists) {
              throw new Error(`Source file does not exist: ${voiceUrl}`);
            }

            const fileName = voiceUrl.split('/').pop();
            const tempPath = `${FileSystem.documentDirectory}${fileName}`;

            // Copy the file to a location that Audio can access
            await FileSystem.copyAsync({
              from: voiceUrl,
              to: tempPath
            });

            audioUrl = tempPath;
            console.log('Copied file from', voiceUrl, 'to', tempPath);
          } catch (error) {
            console.error('Failed to copy file:', error);
            // For missing files, show a proper error message
            if (error.message.includes('does not exist')) {
              throw new Error('Voice message file not found. The recording may have been deleted.');
            }
            // For other errors, try original URI as fallback
            audioUrl = voiceUrl;
          }
        } else {
          // iOS can usually handle file URIs directly
          audioUrl = voiceUrl;
        }
      } else {
        // Check if it looks like a filename (not a full path)
        if (!voiceUrl.includes('/') && !voiceUrl.startsWith('file:')) {
          // Assume it's just a filename, construct the full R2 URL
          const { EXPO_PUBLIC_R2_ENDPOINT, EXPO_PUBLIC_CLOUDFLARE_R2_BUCKET_NAME } = process.env;
          if (EXPO_PUBLIC_R2_ENDPOINT && EXPO_PUBLIC_CLOUDFLARE_R2_BUCKET_NAME) {
            audioUrl = `${EXPO_PUBLIC_R2_ENDPOINT}/${EXPO_PUBLIC_CLOUDFLARE_R2_BUCKET_NAME}/${voiceUrl}`;
          }
        } else {
          // For other paths, use as-is
          audioUrl = voiceUrl;
        }
      }

      console.log('Loading voice message from:', audioUrl.substring(0, 100) + (audioUrl.length > 100 ? '...' : ''));

      // Set audio mode for playback only (no recording permissions)
      const audioModeConfig = {
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      };

      // Add platform-specific interruption modes
      if (Platform.OS === 'ios') {
        audioModeConfig.interruptionModeIOS = Audio.InterruptionModeIOS.DoNotMix;
      }

      await Audio.setAudioModeAsync(audioModeConfig);

      const { sound, status } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: false },
        null, // No status update callback
        true  // Download first (important for web)
      );

      if (!status.isLoaded) {
        throw new Error('Sound failed to load');
      }

      soundRef.current = sound;

      // Get the actual duration from the loaded sound
      if (status.durationMillis) {
        setSoundDuration(status.durationMillis);
      }

      console.log('Sound loaded successfully, duration:', status.durationMillis);
      return sound;
    } catch (error) {
      console.error('Error loading sound:', error);
      Alert.alert('Error', 'Failed to load voice message');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const startPositionTracking = () => {
    positionInterval.current = setInterval(async () => {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.positionMillis !== undefined) {
          setCurrentPosition(status.positionMillis);

          // Auto-stop when finished
          if (status.didJustFinish) {
            await stopPlaying();
          }
        }
      }
    }, 100);
  };

  const stopPositionTracking = () => {
    if (positionInterval.current) {
      clearInterval(positionInterval.current);
      positionInterval.current = null;
    }
  };

  const playSound = async () => {
    try {
      let sound = soundRef.current;

      if (!sound) {
        sound = await loadSound();
        if (!sound) return;
      }

      // Ensure sound is loaded before playing
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) {
        console.log('Sound not loaded, reloading...');
        await sound.unloadAsync();
        soundRef.current = null;
        sound = await loadSound();
        if (!sound) return;
      }

      setIsPlaying(true);
      onPlayStateChange?.(true);

      await sound.playAsync();
      startPositionTracking();
    } catch (error) {
      console.error('Error playing sound:', error);
      setIsPlaying(false);
      onPlayStateChange?.(false);
      Alert.alert('Error', 'Failed to play voice message');
    }
  };

  const pauseSound = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        onPlayStateChange?.(false);
        stopPositionTracking();
      }
    } catch (error) {
      console.error('Error pausing sound:', error);
    }
  };

  const stopPlaying = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.setPositionAsync(0);
        setCurrentPosition(0);
      }
      setIsPlaying(false);
      onPlayStateChange?.(false);
      stopPositionTracking();
    } catch (error) {
      console.error('Error stopping sound:', error);
    }
  };

  const handlePlayPause = () => {
    if (isLoading) return;

    if (isPlaying) {
      pauseSound();
    } else {
      playSound();
    }
  };

  const progress = soundDuration > 0 ? currentPosition / soundDuration : 0;

  // If no voice URL, show a placeholder
  if (!voiceUrl) {
    return (
      <View style={[
        styles.container,
        {
          backgroundColor: isOwnMessage
            ? theme.colors.primary
            : theme.colors.surface,
        }
      ]}>
        <Text style={{
          color: isOwnMessage ? '#fff' : theme.colors.textSecondary,
          fontStyle: 'italic'
        }}>
          Voice message loading...
        </Text>
      </View>
    );
  }

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: isOwnMessage
          ? theme.colors.primary
          : theme.colors.surface,
      }
    ]}>
      {/* Play/Pause Button */}
      <TouchableOpacity
        style={[
          styles.playButton,
          {
            backgroundColor: isOwnMessage
              ? 'rgba(255,255,255,0.2)'
              : 'rgba(0,0,0,0.1)',
          }
        ]}
        onPress={handlePlayPause}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={isOwnMessage ? '#fff' : theme.colors.primary}
          />
        ) : (
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={20}
            color={isOwnMessage ? '#fff' : theme.colors.primary}
          />
        )}
      </TouchableOpacity>

      {/* Waveform/Progress */}
      <View style={styles.waveformContainer}>
        <View style={[
          styles.progressBar,
          {
            backgroundColor: isOwnMessage
              ? 'rgba(255,255,255,0.3)'
              : 'rgba(0,0,0,0.1)',
          }
        ]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progress * 100}%`,
                backgroundColor: isOwnMessage
                  ? '#fff'
                  : theme.colors.primary,
              }
            ]}
          />
        </View>

        {/* Duration */}
        <Text style={[
          styles.durationText,
          {
            color: isOwnMessage
              ? 'rgba(255,255,255,0.8)'
              : theme.colors.textSecondary,
          }
        ]}>
          {formatTime(isPlaying ? currentPosition : soundDuration)}
        </Text>
      </View>

      {/* Voice Icon */}
      <View style={styles.voiceIcon}>
        <Ionicons
          name="mic"
          size={16}
          color={isOwnMessage ? '#fff' : theme.colors.textSecondary}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    minWidth: 200,
    maxWidth: 280,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  waveformContainer: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 8,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '500',
  },
  voiceIcon: {
    marginLeft: 4,
  },
});
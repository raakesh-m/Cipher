import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import realtimeService from '../services/realtimeService';
import { AppState } from 'react-native';

const ConnectionStatus = () => {
  const { theme } = useTheme();
  const [connectionState, setConnectionState] = useState('connecting');
  const [isVisible, setIsVisible] = useState(false);
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    let statusCheckInterval;

    const checkConnectionStatus = () => {
      const isConnected = realtimeService.getConnectionStatus();
      const newState = isConnected ? 'connected' : 'disconnected';
      
      if (newState !== connectionState) {
        setConnectionState(newState);
        
        // Show status bar for disconnected/connecting states
        if (newState !== 'connected') {
          setIsVisible(true);
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: false,
          }).start();
        } else {
          // Hide after being connected for 2 seconds
          setTimeout(() => {
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: false,
            }).start(() => {
              setIsVisible(false);
            });
          }, 2000);
        }
      }
    };

    // Check connection status every 2 seconds
    statusCheckInterval = setInterval(checkConnectionStatus, 2000);
    
    // Initial check
    checkConnectionStatus();

    // Listen for app state changes
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        setConnectionState('connecting');
        checkConnectionStatus();
      } else {
        setConnectionState('background');
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // NetInfo handling removed for simplicity

    return () => {
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }
      if (appStateSubscription) {
        appStateSubscription.remove();
      }
    };
  }, [connectionState]);

  const getStatusConfig = () => {
    switch (connectionState) {
      case 'connected':
        return {
          text: 'Connected',
          icon: 'checkmark-circle',
          color: theme.colors.success || '#22c55e',
          backgroundColor: theme.colors.successBackground || 'rgba(34, 197, 94, 0.1)',
        };
      case 'connecting':
        return {
          text: 'Connecting...',
          icon: 'sync',
          color: theme.colors.warning || '#f59e0b',
          backgroundColor: theme.colors.warningBackground || 'rgba(245, 158, 11, 0.1)',
        };
      case 'disconnected':
        return {
          text: 'Connection lost',
          icon: 'alert-circle',
          color: theme.colors.error || '#ef4444',
          backgroundColor: theme.colors.errorBackground || 'rgba(239, 68, 68, 0.1)',
        };
      case 'no_internet':
        return {
          text: 'No internet connection',
          icon: 'wifi-off',
          color: theme.colors.error || '#ef4444',
          backgroundColor: theme.colors.errorBackground || 'rgba(239, 68, 68, 0.1)',
        };
      case 'background':
        return {
          text: 'App in background',
          icon: 'moon',
          color: theme.colors.textSecondary,
          backgroundColor: theme.colors.surface,
        };
      default:
        return null;
    }
  };

  if (!isVisible) {
    return null;
  }

  const statusConfig = getStatusConfig();
  if (!statusConfig) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: statusConfig.backgroundColor,
          opacity: fadeAnim,
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons
          name={statusConfig.icon}
          size={16}
          color={statusConfig.color}
          style={connectionState === 'connecting' ? styles.spinningIcon : null}
        />
        <Text
          style={[
            styles.text,
            { color: statusConfig.color },
          ]}
        >
          {statusConfig.text}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    margin: 8,
    marginBottom: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
  },
  spinningIcon: {
    // Add spinning animation for connecting state
    transform: [{ rotate: '0deg' }],
  },
});

export default ConnectionStatus;
import React, { useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

const AnimatedThemeToggle = ({ onToggle, style }) => {
  const { theme, themePreference, setTheme, isDark } = useTheme();
  
  // Animation values
  const toggleAnimation = useRef(new Animated.Value(isDark ? 1 : 0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const rotateAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  
  // Colors for interpolation
  const lightColor = '#FFD700'; // Golden sun
  const darkColor = '#4169E1';  // Royal blue moon
  const toggleBgLight = '#E8E8E8';
  const toggleBgDark = '#2D3748';

  useEffect(() => {
    // Animate toggle position when theme changes
    Animated.parallel([
      Animated.spring(toggleAnimation, {
        toValue: isDark ? 1 : 0,
        useNativeDriver: false,
        tension: 150,
        friction: 8,
      }),
      Animated.sequence([
        Animated.timing(rotateAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [isDark]);

  // Continuous pulse animation for active state
  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
      { iterations: -1 }
    );
    pulseLoop.start();
    
    return () => pulseLoop.stop();
  }, []);

  const handlePress = () => {
    // Haptic feedback and scale animation
    Animated.sequence([
      Animated.timing(scaleAnimation, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Toggle between light and dark (skip system for toggle)
    const newTheme = isDark ? 'light' : 'dark';
    setTheme(newTheme);
    onToggle?.(newTheme);
  };

  // Interpolated values for smooth transitions
  const togglePosition = toggleAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 36], // Position of the toggle button
  });

  const backgroundColor = toggleAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [toggleBgLight, toggleBgDark],
  });

  const iconColor = toggleAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [lightColor, '#FFFFFF'],
  });

  const shadowOpacity = toggleAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.4],
  });

  const rotateValue = rotateAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            { scale: scaleAnimation },
            { scale: pulseAnimation },
          ],
        },
        style,
      ]}
    >
      <TouchableOpacity
        style={styles.toggleContainer}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        {/* Toggle Background Track */}
        <Animated.View
          style={[
            styles.toggleTrack,
            {
              backgroundColor,
              shadowOpacity,
            },
          ]}
        >
          {/* Background Icons */}
          <View style={styles.backgroundIcons}>
            {/* Sun Icon */}
            <Animated.View
              style={[
                styles.backgroundIcon,
                styles.sunPosition,
                {
                  opacity: toggleAnimation.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.3, 0.1, 0],
                  }),
                },
              ]}
            >
              <Ionicons name="sunny" size={16} color="#FFD700" />
            </Animated.View>
            
            {/* Moon Icon */}
            <Animated.View
              style={[
                styles.backgroundIcon,
                styles.moonPosition,
                {
                  opacity: toggleAnimation.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 0.1, 0.3],
                  }),
                },
              ]}
            >
              <Ionicons name="moon" size={16} color="#E2E8F0" />
            </Animated.View>
          </View>

          {/* Moving Toggle Button */}
          <Animated.View
            style={[
              styles.toggleButton,
              {
                transform: [
                  { translateX: togglePosition },
                  { rotate: rotateValue },
                ],
                shadowOpacity: shadowOpacity,
              },
            ]}
          >
            {/* Main Icon */}
            <Animated.View
              style={[
                styles.iconContainer,
                {
                  transform: [{ rotate: rotateValue }],
                },
              ]}
            >
              <Animated.View style={{ opacity: toggleAnimation.interpolate({
                inputRange: [0, 0.3, 0.7, 1],
                outputRange: [1, 0, 0, 0],
              })}}>
                <Ionicons name="sunny" size={18} color={lightColor} />
              </Animated.View>
              
              <Animated.View 
                style={[
                  StyleSheet.absoluteFill,
                  styles.iconContainer,
                  {
                    opacity: toggleAnimation.interpolate({
                      inputRange: [0, 0.3, 0.7, 1],
                      outputRange: [0, 0, 0, 1],
                    }),
                  },
                ]}
              >
                <Ionicons name="moon" size={18} color="#FFFFFF" />
              </Animated.View>
            </Animated.View>

            {/* Animated Glow Effect */}
            <Animated.View
              style={[
                styles.glowEffect,
                {
                  backgroundColor: iconColor,
                  opacity: toggleAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 0.5],
                  }),
                  transform: [
                    {
                      scale: pulseAnimation.interpolate({
                        inputRange: [1, 1.05],
                        outputRange: [1, 1.2],
                      }),
                    },
                  ],
                },
              ]}
            />
          </Animated.View>
        </Animated.View>

        {/* Floating Particles Effect */}
        <Animated.View
          style={[
            styles.particleContainer,
            {
              opacity: toggleAnimation.interpolate({
                inputRange: [0, 0.2, 0.8, 1],
                outputRange: [0, 1, 1, 0],
              }),
            },
          ]}
        >
          {[...Array(3)].map((_, index) => (
            <Animated.View
              key={index}
              style={[
                styles.particle,
                {
                  opacity: pulseAnimation.interpolate({
                    inputRange: [1, 1.05],
                    outputRange: [0.6, 1],
                  }),
                  transform: [
                    {
                      translateY: pulseAnimation.interpolate({
                        inputRange: [1, 1.05],
                        outputRange: [0, -2 - index],
                      }),
                    },
                    {
                      translateX: index % 2 === 0 ? 
                        pulseAnimation.interpolate({
                          inputRange: [1, 1.05],
                          outputRange: [0, 1],
                        }) :
                        pulseAnimation.interpolate({
                          inputRange: [1, 1.05],
                          outputRange: [0, -1],
                        })
                    },
                  ],
                },
              ]}
            >
              <View
                style={[
                  styles.particleDot,
                  {
                    backgroundColor: isDark ? '#60A5FA' : '#FCD34D',
                  },
                ]}
              />
            </Animated.View>
          ))}
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleContainer: {
    position: 'relative',
  },
  toggleTrack: {
    width: 68,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  backgroundIcons: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  backgroundIcon: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sunPosition: {
    left: 12,
    top: 10,
  },
  moonPosition: {
    right: 12,
    top: 10,
  },
  toggleButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 20,
    height: 20,
  },
  glowEffect: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    zIndex: -1,
  },
  particleContainer: {
    position: 'absolute',
    top: -10,
    left: 0,
    right: 0,
    bottom: -10,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  particle: {
    position: 'absolute',
  },
  particleDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
});

export default AnimatedThemeToggle;
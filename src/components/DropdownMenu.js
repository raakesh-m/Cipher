import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function DropdownMenu({
  isVisible,
  onClose,
  anchorPosition,
  menuItems,
}) {
  const { theme } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible]);

  const handleItemPress = (item) => {
    onClose();
    setTimeout(() => {
      item.onPress();
    }, 100);
  };

  if (!isVisible) return null;

  // Calculate menu position
  const menuWidth = 200;
  const menuHeight = menuItems.length * 50 + 20;

  // Ensure menu stays within screen bounds
  let left = anchorPosition.x - menuWidth + 50; // Offset to align with button
  let top = anchorPosition.y + 40; // Below the button

  if (left < 10) left = 10;
  if (left + menuWidth > screenWidth - 10) left = screenWidth - menuWidth - 10;
  if (top + menuHeight > screenHeight - 100) top = anchorPosition.y - menuHeight - 10;

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <Animated.View
            style={[
              styles.menu,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                left,
                top,
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.menuItem,
                  {
                    borderBottomColor: theme.colors.divider,
                    borderBottomWidth: index < menuItems.length - 1 ? 1 : 0,
                  },
                ]}
                onPress={() => handleItemPress(item)}
              >
                <View style={styles.menuItemContent}>
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={theme.colors.textPrimary}
                    style={styles.menuIcon}
                  />
                  <Text
                    style={[
                      styles.menuText,
                      { color: theme.colors.textPrimary },
                    ]}
                  >
                    {item.title}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  },
  menu: {
    position: "absolute",
    borderRadius: 12,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    minWidth: 180,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuIcon: {
    marginRight: 12,
  },
  menuText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
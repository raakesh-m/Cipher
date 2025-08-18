import React from "react";
import {
  View,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { Image } from "expo-image";
import { Video } from "expo-av";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

export default function MediaViewerScreen({ route, navigation }) {
  const { mediaUrl, mediaType } = route.params;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.mediaContainer}>
        {mediaType === "image" ? (
          <Image
            source={{ uri: mediaUrl }}
            style={styles.image}
            contentFit="contain"
            transition={200}
          />
        ) : (
          <Video
            source={{ uri: mediaUrl }}
            style={styles.video}
            useNativeControls
            resizeMode="contain"
            shouldPlay={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    position: "absolute",
    top: 44,
    left: 0,
    right: 0,
    zIndex: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  closeButton: {
    alignSelf: "flex-end",
    padding: 8,
  },
  mediaContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: width,
    height: height,
  },
  video: {
    width: width,
    height: height * 0.6,
  },
});

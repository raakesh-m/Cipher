import React, { useState } from "react";
import {
  View,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  TouchableOpacity,
  StatusBar,
  Text,
} from "react-native";
import { Image } from "expo-image";
import { Video } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";

const { width, height } = Dimensions.get("window");

export default function MediaViewerScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { mediaUrl, mediaType } = route.params;
  const [showControls, setShowControls] = useState(true);
  const [videoStatus, setVideoStatus] = useState({});

  const toggleControls = () => {
    setShowControls(!showControls);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden />
      
      {/* Header with controls */}
      {showControls && (
        <View style={[
          styles.header,
          { backgroundColor: 'rgba(0,0,0,0.7)' }
        ]}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            
            <Text style={styles.headerTitle}>
              {mediaType === 'image' ? 'Photo' : 'Video'}
            </Text>
            
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Media Container */}
      <TouchableOpacity 
        style={styles.mediaContainer}
        activeOpacity={1}
        onPress={toggleControls}
      >
        {mediaType === "image" ? (
          <Image
            source={{ uri: mediaUrl }}
            style={styles.image}
            contentFit="contain"
            transition={300}
            placeholder={{ uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==' }}
          />
        ) : (
          <Video
            source={{ uri: mediaUrl }}
            style={styles.video}
            useNativeControls={showControls}
            resizeMode="contain"
            shouldPlay={false}
            onPlaybackStatusUpdate={setVideoStatus}
          />
        )}
      </TouchableOpacity>

      {/* Bottom controls for video */}
      {mediaType === 'video' && showControls && (
        <View style={[
          styles.bottomControls,
          { backgroundColor: 'rgba(0,0,0,0.7)' }
        ]}>
          <Text style={styles.videoInfo}>
            {videoStatus.durationMillis && videoStatus.positionMillis
              ? `${Math.floor(videoStatus.positionMillis / 1000)}s / ${Math.floor(videoStatus.durationMillis / 1000)}s`
              : 'Loading...'}
          </Text>
        </View>
      )}
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
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: 44,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
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
    height: height,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 34,
  },
  videoInfo: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});

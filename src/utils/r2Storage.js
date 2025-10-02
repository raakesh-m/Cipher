import {
  EXPO_PUBLIC_CLOUDFLARE_R2_BUCKET_NAME,
  EXPO_PUBLIC_R2_ENDPOINT,
  EXPO_PUBLIC_R2_ACCESS_KEY_ID,
  EXPO_PUBLIC_R2_SECRET_ACCESS_KEY,
  EXPO_PUBLIC_CLOUDFLARE_R2_ACCOUNT_ID
} from "@env";
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

// Upload file to Cloudflare R2 (or Supabase Storage as fallback)
export const uploadToR2 = async (fileUri, fileName, contentType = 'application/octet-stream') => {
  try {
    console.log(`📤 Uploading ${fileName}...`);
    console.log('File URI:', fileUri);
    console.log('Platform:', Platform.OS);

    // For development: Return the file URI directly for local testing
    // In production, implement proper upload to R2 via backend API
    if (fileUri.startsWith('file:') && Platform.OS === 'android') {
      console.log('⚠️ Development mode: Using local file URI');
      console.log('⚠️ In production, implement backend API to upload to R2');

      // Read file as base64 to create a data URL for persistence
      const base64Data = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const dataUrl = `data:${contentType};base64,${base64Data}`;
      console.log('✅ Converted to data URL for development');
      return dataUrl;
    }

    if (fileUri.startsWith('blob:')) {
      console.log('⚠️ Development mode: Converting blob to data URL');
      const response = await fetch(fileUri);
      const blob = await response.blob();

      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      console.log('✅ Converted blob to data URL for development');
      return dataUrl;
    }

    if (fileUri.startsWith('data:')) {
      console.log('Already a data URL');
      return fileUri;
    }

    // For HTTP URLs, return as-is
    if (fileUri.startsWith('http')) {
      console.log('HTTP URL, returning as-is');
      return fileUri;
    }

    throw new Error('Unsupported file URI format');

  } catch (error) {
    console.error("❌ Upload error:", error);
    throw error;
  }
};

// Get public URL for R2 object
export const getR2Url = (fileName) => {
  return `${EXPO_PUBLIC_R2_ENDPOINT}/${EXPO_PUBLIC_CLOUDFLARE_R2_BUCKET_NAME}/${fileName}`;
};

// Generate presigned URL for secure upload (implement later if needed)
export const generatePresignedUrl = async (fileName, contentType) => {
  // This would typically be done on your backend for security
  // For now, we'll use direct upload
  return `${EXPO_PUBLIC_R2_ENDPOINT}/${EXPO_PUBLIC_CLOUDFLARE_R2_BUCKET_NAME}/${fileName}`;
};

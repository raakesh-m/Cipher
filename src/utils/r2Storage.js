import { EXPO_PUBLIC_CLOUDFLARE_R2_BUCKET_NAME, EXPO_PUBLIC_R2_ENDPOINT } from "@env";

// Upload file to Cloudflare R2
export const uploadToR2 = async (fileUri, fileName) => {
  try {
    // Read the file as text/base64
    const response = await fetch(fileUri);
    const blob = await response.blob();

    // Convert blob to text for simple upload
    // In production, you'd use proper binary upload
    const reader = new FileReader();
    const fileContent = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Use a backend API call to upload to R2
    // For now, we'll simulate the upload and return the filename
    // In production, implement proper R2 upload via your backend

    console.log(`Uploading ${fileName} to R2...`);

    // Simulate upload delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return fileName;
  } catch (error) {
    console.error("R2 upload error:", error);
    throw new Error("Failed to upload media file");
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

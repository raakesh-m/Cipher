import { uploadToR2 } from '../utils/r2Storage';
import * as FileSystem from 'expo-file-system';

class R2MessageStorage {
  constructor() {
    this.cache = new Map(); // In-memory cache for frequently accessed content
  }

  /**
   * Store a text message in R2
   * @param {string} messageId - Unique message identifier
   * @param {string} textContent - The text content to store
   * @param {string} translatedContent - Optional translated content
   * @returns {Promise<Object>} - Object with original and translated R2 URLs
   */
  async storeTextMessage(messageId, textContent, translatedContent = null) {
    try {
      const promises = [];
      const result = {};

      // Store original content
      if (textContent) {
        const originalFileName = `messages/text/${messageId}_original.txt`;
        promises.push(
          this.uploadTextToR2(originalFileName, textContent).then(url => {
            result.originalUrl = url;
          })
        );
      }

      // Store translated content if available
      if (translatedContent) {
        const translatedFileName = `messages/text/${messageId}_translated.txt`;
        promises.push(
          this.uploadTextToR2(translatedFileName, translatedContent).then(url => {
            result.translatedUrl = url;
          })
        );
      }

      await Promise.all(promises);
      return result;
    } catch (error) {
      console.error('Error storing text message in R2:', error);
      throw error;
    }
  }

  /**
   * Store a voice message in R2
   * @param {string} messageId - Unique message identifier
   * @param {string} voiceFileUri - Local path to voice file
   * @returns {Promise<string>} - R2 URL for the voice file
   */
  async storeVoiceMessage(messageId, voiceFileUri) {
    try {
      const fileName = `messages/voice/${messageId}.m4a`;
      return await uploadToR2(voiceFileUri, fileName, 'audio/m4a');
    } catch (error) {
      console.error('Error storing voice message in R2:', error);
      throw error;
    }
  }

  /**
   * Store an image message in R2
   * @param {string} messageId - Unique message identifier
   * @param {string} imageFileUri - Local path to image file
   * @returns {Promise<string>} - R2 URL for the image file
   */
  async storeImageMessage(messageId, imageFileUri) {
    try {
      const fileName = `messages/images/${messageId}.jpg`;
      return await uploadToR2(imageFileUri, fileName, 'image/jpeg');
    } catch (error) {
      console.error('Error storing image message in R2:', error);
      throw error;
    }
  }

  /**
   * Store a video message in R2
   * @param {string} messageId - Unique message identifier
   * @param {string} videoFileUri - Local path to video file
   * @returns {Promise<string>} - R2 URL for the video file
   */
  async storeVideoMessage(messageId, videoFileUri) {
    try {
      const fileName = `messages/videos/${messageId}.mp4`;
      return await uploadToR2(videoFileUri, fileName, 'video/mp4');
    } catch (error) {
      console.error('Error storing video message in R2:', error);
      throw error;
    }
  }

  /**
   * Store a file attachment in R2
   * @param {string} messageId - Unique message identifier
   * @param {string} fileUri - Local path to file
   * @param {string} originalFileName - Original file name
   * @param {string} mimeType - MIME type of the file
   * @returns {Promise<string>} - R2 URL for the file
   */
  async storeFileMessage(messageId, fileUri, originalFileName, mimeType) {
    try {
      const extension = originalFileName.split('.').pop() || 'bin';
      const fileName = `messages/files/${messageId}.${extension}`;
      return await uploadToR2(fileUri, fileName, mimeType);
    } catch (error) {
      console.error('Error storing file message in R2:', error);
      throw error;
    }
  }

  /**
   * Store complete message data in R2 as JSON metadata
   * @param {string} messageId - Unique message identifier
   * @param {Object} messageData - Complete message object
   * @returns {Promise<string>} - R2 URL for the metadata file
   */
  async storeMessageMetadata(messageId, messageData) {
    try {
      const fileName = `messages/metadata/${messageId}.json`;
      const jsonContent = JSON.stringify(messageData, null, 2);
      return await this.uploadTextToR2(fileName, jsonContent, 'application/json');
    } catch (error) {
      console.error('Error storing message metadata in R2:', error);
      throw error;
    }
  }

  /**
   * Retrieve text content from R2
   * @param {string} r2Url - R2 URL of the text file
   * @returns {Promise<string>} - Text content
   */
  async retrieveTextContent(r2Url) {
    try {
      // Check cache first
      if (this.cache.has(r2Url)) {
        return this.cache.get(r2Url);
      }

      const response = await fetch(r2Url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();

      // Cache the content (with size limit)
      if (content.length < 10000) { // Cache only small text files
        this.cache.set(r2Url, content);

        // Limit cache size
        if (this.cache.size > 100) {
          const firstKey = this.cache.keys().next().value;
          this.cache.delete(firstKey);
        }
      }

      return content;
    } catch (error) {
      console.error('Error retrieving text content from R2:', error);
      throw error;
    }
  }

  /**
   * Retrieve message metadata from R2
   * @param {string} r2Url - R2 URL of the metadata file
   * @returns {Promise<Object>} - Parsed message data
   */
  async retrieveMessageMetadata(r2Url) {
    try {
      const jsonContent = await this.retrieveTextContent(r2Url);
      return JSON.parse(jsonContent);
    } catch (error) {
      console.error('Error retrieving message metadata from R2:', error);
      throw error;
    }
  }

  /**
   * Helper method to upload text content to R2
   * @param {string} fileName - File name in R2
   * @param {string} content - Text content
   * @param {string} contentType - MIME type
   * @returns {Promise<string>} - R2 URL
   */
  async uploadTextToR2(fileName, content, contentType = 'text/plain') {
    try {
      // Create a temporary file
      const tempDir = FileSystem.cacheDirectory + 'temp_uploads/';
      await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });

      const tempFilePath = tempDir + fileName.replace(/\//g, '_');
      await FileSystem.writeAsStringAsync(tempFilePath, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Upload to R2
      const r2Url = await uploadToR2(tempFilePath, fileName, contentType);

      // Clean up temp file
      try {
        await FileSystem.deleteAsync(tempFilePath);
      } catch (cleanupError) {
        console.warn('Failed to clean up temp file:', cleanupError);
      }

      return r2Url;
    } catch (error) {
      console.error('Error uploading text to R2:', error);
      throw error;
    }
  }

  /**
   * Store a complete message with all its content in R2
   * @param {Object} message - Message object
   * @returns {Promise<Object>} - Object with R2 URLs for all content
   */
  async storeCompleteMessage(message) {
    try {
      const messageId = message.temp_id || message.id;
      const result = {
        messageId,
        r2Urls: {},
        metadata: {}
      };

      // Store based on message type
      switch (message.message_type) {
        case 'text':
          if (message.content_original) {
            const textUrls = await this.storeTextMessage(
              messageId,
              message.content_original,
              message.content_translated
            );
            result.r2Urls.originalText = textUrls.originalUrl;
            if (textUrls.translatedUrl) {
              result.r2Urls.translatedText = textUrls.translatedUrl;
            }
          }
          break;

        case 'voice':
          if (message.voiceFileUri) {
            result.r2Urls.voice = await this.storeVoiceMessage(messageId, message.voiceFileUri);
          }
          break;

        case 'image':
          if (message.imageFileUri) {
            result.r2Urls.image = await this.storeImageMessage(messageId, message.imageFileUri);
          }
          break;

        case 'video':
          if (message.videoFileUri) {
            result.r2Urls.video = await this.storeVideoMessage(messageId, message.videoFileUri);
          }
          break;

        case 'file':
          if (message.fileUri) {
            result.r2Urls.file = await this.storeFileMessage(
              messageId,
              message.fileUri,
              message.fileName || 'file',
              message.mimeType || 'application/octet-stream'
            );
          }
          break;
      }

      // Store metadata
      const metadataToStore = {
        ...message,
        r2Urls: result.r2Urls,
        storedAt: new Date().toISOString()
      };

      result.r2Urls.metadata = await this.storeMessageMetadata(messageId, metadataToStore);
      result.metadata = metadataToStore;

      return result;
    } catch (error) {
      console.error('Error storing complete message in R2:', error);
      throw error;
    }
  }

  /**
   * Clear the in-memory cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
export default new R2MessageStorage();
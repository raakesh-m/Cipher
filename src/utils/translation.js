import * as Crypto from "expo-crypto";
import { supabase } from "../../utils/supabase";

// Simple encryption/decryption for API keys (in production, use a more robust solution)
const ENCRYPTION_KEY = "cipher_app_key_2024"; // In production, use a proper key management system

// Check if translation is enabled for the current user
export const isTranslationEnabled = async () => {
  // Translation is always enabled - no database check needed
  // If you want to add a toggle in the future, add a translation_enabled column to profiles table
  return true;
};

export const encryptApiKey = async (apiKey) => {
  // Simple base64 encoding (not cryptographically secure, but better than plaintext)
  const saltedKey = ENCRYPTION_KEY + apiKey + ENCRYPTION_KEY;
  return btoa(saltedKey);
};

export const decryptApiKey = async (encryptedKey) => {
  try {
    const decoded = atob(encryptedKey);
    // Extract the API key (remove the key prefix and suffix)
    const apiKey = decoded.substring(
      ENCRYPTION_KEY.length,
      decoded.length - ENCRYPTION_KEY.length
    );
    return apiKey;
  } catch (error) {
    throw new Error("Failed to decrypt API key");
  }
};

export const shouldTranslateMessage = async (
  text,
  knownLanguages,
  preferredLanguage,
  encryptedApiKey
) => {
  // Check if translation is enabled for the user
  const translationEnabled = await isTranslationEnabled();

  if (!translationEnabled) {
    return null; // Don't translate if disabled
  }

  if (!knownLanguages || knownLanguages.length === 0) {
    return preferredLanguage || "English"; // Default fallback
  }

  try {
    const apiKey = await decryptApiKey(encryptedApiKey);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Analyze this text: "${text}"

User's known languages: ${knownLanguages.join(", ")}
User's preferred language: ${preferredLanguage}

Simple rules:
1. If the text is in any of the user's known languages → return "NO_TRANSLATION_NEEDED"
2. If the text is in an unknown language → return the user's preferred language

Only return either "NO_TRANSLATION_NEEDED" or the preferred language name.

Examples:
- Text in English, known: ["English", "Tamil"] → "NO_TRANSLATION_NEEDED"
- Text in German, known: ["English", "Tamil"], preferred: "English" → "English"
- Text in Tamil, known: ["Tamil", "Hindi"], preferred: "Tamil" → "NO_TRANSLATION_NEEDED"`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 50,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error("Language detection failed, using preferred language");
      return preferredLanguage || "English";
    }

    const data = await response.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    if (result === "NO_TRANSLATION_NEEDED") {
      return null; // Don't translate
    }
    
    return result || preferredLanguage || "English";
  } catch (error) {
    console.error("Error detecting language:", error);
    return preferredLanguage || "English"; // Fallback to preferred language
  }
};

export const translateMessage = async (
  text,
  targetLanguage,
  encryptedApiKey
) => {
  try {
    const apiKey = await decryptApiKey(encryptedApiKey);

    // Get the language name - if not in our map, use it directly (AI will understand)
    const languageName = getLanguageName(targetLanguage);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Translate the following text to ${languageName}. Only return the translated text, nothing else. If the language is not clear, treat it as the language name and do your best:\n\n${text}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1000,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();

      if (response.status === 429) {
        throw new Error("Translation failed - API limit reached");
      } else if (response.status === 400) {
        throw new Error("Translation failed - API key not valid. Please pass a valid API key.");
      } else if (response.status === 403) {
        throw new Error("Translation failed - Invalid API key or permission denied");
      } else {
        throw new Error(
          `Translation failed - ${errorData.error?.message || "Unknown error"}`
        );
      }
    }

    const data = await response.json();
    const translatedText =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!translatedText) {
      throw new Error("Translation failed - No response from API");
    }

    return translatedText;
  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
};

// New function for sender-side translation (pre-send)
export const translateMessageForRecipient = async (
  messageText,
  senderKnownLanguages,
  recipientKnownLanguages,
  recipientPreferredLanguage,
  senderApiKey
) => {
  // Check if translation is enabled for the sender
  const translationEnabled = await isTranslationEnabled();

  if (!translationEnabled || !senderApiKey || !recipientKnownLanguages || !recipientPreferredLanguage) {
    return {
      needsTranslation: false,
      originalText: messageText,
      translatedText: null,
      detectedLanguage: null,
      error: translationEnabled ? null : "Translation is disabled"
    };
  }

  try {
    // Step 1: Detect what language the sender is typing in
    const detectedLanguage = await detectMessageLanguage(
      messageText,
      senderKnownLanguages,
      senderApiKey
    );

    console.log(`🔍 Detected language: ${detectedLanguage} for message: "${messageText.substring(0, 50)}..."`);

    // Step 2: Check if recipient knows this language
    const recipientKnowsLanguage = recipientKnownLanguages.some(lang => 
      lang.toLowerCase() === detectedLanguage.toLowerCase()
    );

    if (recipientKnowsLanguage) {
      console.log(`✅ Recipient knows ${detectedLanguage} - no translation needed`);
      return {
        needsTranslation: false,
        originalText: messageText,
        translatedText: null,
        detectedLanguage,
        error: null
      };
    }

    // Step 3: Translate to recipient's preferred language
    console.log(`🔄 Translating from ${detectedLanguage} to ${recipientPreferredLanguage}`);
    const translatedText = await translateMessage(
      messageText,
      recipientPreferredLanguage,
      senderApiKey
    );

    return {
      needsTranslation: true,
      originalText: messageText,
      translatedText,
      detectedLanguage,
      error: null
    };

  } catch (error) {
    console.error('❌ Translation failed:', error);
    return {
      needsTranslation: false,
      originalText: messageText,
      translatedText: null,
      detectedLanguage: null,
      error: error.message
    };
  }
};

// Detect what language a message is written in
export const detectMessageLanguage = async (
  text,
  senderKnownLanguages,
  encryptedApiKey
) => {
  try {
    const apiKey = await decryptApiKey(encryptedApiKey);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Analyze this text and identify its language: "${text}"

Sender's known languages: ${senderKnownLanguages?.join(", ") || "Unknown"}

Rules:
1. Return ONLY the language name (e.g., "English", "Tamil", "Spanish")
2. If the text mixes languages, return the dominant language
3. If uncertain, pick the most likely language from sender's known languages

Examples:
- "Hello how are you?" → "English"
- "¿Cómo estás?" → "Spanish"  
- "வணக்கம்" → "Tamil"
- "Bonjour mon ami" → "French"

Only return the language name, nothing else.`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 20,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Language detection API failed');
    }

    const data = await response.json();
    const detectedLanguage = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    return detectedLanguage || "English"; // Fallback to English

  } catch (error) {
    console.error("Language detection error:", error);
    // Fallback: assume first known language or English
    return senderKnownLanguages?.[0] || "English";
  }
};

const getLanguageName = (code) => {
  // Common language codes for quick lookup
  const languageMap = {
    en: "English",
    es: "Spanish", 
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese", 
    ru: "Russian",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    ar: "Arabic",
    hi: "Hindi",
    ta: "Tamil",
    te: "Telugu",
    bn: "Bengali",
    ur: "Urdu",
    th: "Thai",
    vi: "Vietnamese",
    tr: "Turkish",
    pl: "Polish",
    nl: "Dutch",
    sv: "Swedish",
    da: "Danish",
    no: "Norwegian",
    fi: "Finnish",
    // Add more as needed...
  };

  // If we have a mapping, use it. Otherwise, return the code itself 
  // (AI will understand language names or codes directly)
  return languageMap[code] || code;
};

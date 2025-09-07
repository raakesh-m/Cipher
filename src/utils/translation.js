import * as Crypto from "expo-crypto";

// Simple encryption/decryption for API keys (in production, use a more robust solution)
const ENCRYPTION_KEY = "cipher_app_key_2024"; // In production, use a proper key management system

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

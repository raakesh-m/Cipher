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

export const translateMessage = async (
  text,
  targetLanguage,
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
                  text: `Translate the following text to ${getLanguageName(
                    targetLanguage
                  )}. Only return the translated text, nothing else:\n\n${text}`,
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
    zh: "Chinese (Simplified)",
    ar: "Arabic",
    hi: "Hindi",
    th: "Thai",
    vi: "Vietnamese",
    nl: "Dutch",
    sv: "Swedish",
    da: "Danish",
    no: "Norwegian",
    fi: "Finnish",
    pl: "Polish",
    cs: "Czech",
    hu: "Hungarian",
    ro: "Romanian",
    tr: "Turkish",
    he: "Hebrew",
    fa: "Persian",
    ur: "Urdu",
    bn: "Bengali",
    ta: "Tamil",
    te: "Telugu",
    mr: "Marathi",
    gu: "Gujarati",
    kn: "Kannada",
    ml: "Malayalam",
    or: "Odia",
    pa: "Punjabi",
    as: "Assamese",
    ne: "Nepali",
    si: "Sinhala",
    my: "Myanmar",
    km: "Khmer",
    lo: "Lao",
    ka: "Georgian",
    am: "Amharic",
    sw: "Swahili",
    yo: "Yoruba",
    ig: "Igbo",
    ha: "Hausa",
    zu: "Zulu",
    af: "Afrikaans",
  };

  return languageMap[code] || code;
};

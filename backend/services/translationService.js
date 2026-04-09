const axios = require("axios");

const GOOGLE_TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2";

const translateText = async ({ text, targetLanguage = "en" }) => {
  if (!text || targetLanguage === "en") {
    return { translatedText: text, provider: "none" };
  }

  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) {
    return { translatedText: text, provider: "none", warning: "Translation API not configured." };
  }

  const response = await axios.post(
    `${GOOGLE_TRANSLATE_URL}?key=${apiKey}`,
    {
      q: text,
      target: targetLanguage,
      format: "text",
    },
    {
      timeout: 12000,
    }
  );

  const translatedText =
    response.data?.data?.translations?.[0]?.translatedText || text;

  return {
    translatedText,
    provider: "Google Cloud Translation",
  };
};

module.exports = {
  translateText,
};

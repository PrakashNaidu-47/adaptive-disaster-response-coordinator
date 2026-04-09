const axios = require("axios");

const { translateText } = require("./translationService");

const sendSmsAlert = async ({ recipients, body, targetLanguage = "en" }) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from) {
    throw new Error("Twilio credentials are not configured.");
  }

  const translated = await translateText({ text: body, targetLanguage });
  const messageBody = translated.translatedText;
  const results = [];

  for (const recipient of recipients) {
    const params = new URLSearchParams({
      To: recipient,
      From: from,
      Body: messageBody,
    });

    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      params,
      {
        auth: {
          username: accountSid,
          password: authToken,
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 12000,
      }
    );

    results.push({
      to: recipient,
      sid: response.data?.sid,
      status: response.data?.status,
    });
  }

  return {
    provider: "Twilio",
    message: messageBody,
    translationProvider: translated.provider,
    results,
  };
};

module.exports = {
  sendSmsAlert,
};

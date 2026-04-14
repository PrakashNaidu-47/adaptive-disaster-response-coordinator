const axios = require("axios");

const { translateText } = require("./translationService");

const normalizeRecipients = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const sendEmailAlert = async ({
  recipients,
  subject,
  body,
  targetLanguage = "en",
}) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "Disaster Response";
  const replyTo = process.env.BREVO_REPLY_TO;
  if (!apiKey || !senderEmail) {
    throw new Error("BREVO_API_KEY and BREVO_SENDER_EMAIL are not configured.");
  }
  const translated = await translateText({ text: body, targetLanguage });
  const messageBody = translated.translatedText;
  const results = [];

  for (const recipient of recipients) {
    try {
      const payload = {
        sender: { name: senderName, email: senderEmail },
        to: [{ email: recipient }],
        subject: subject || "Emergency Alert",
        textContent: messageBody,
      };
      if (replyTo) {
        payload.replyTo = { email: replyTo };
      }
      const response = await axios.post(BREVO_API_URL, payload, {
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
          accept: "application/json",
        },
        timeout: 12000,
      });
      results.push({ to: recipient, messageId: response.data?.messageId, status: "queued" });
    } catch (error) {
      results.push({ to: recipient, error: error.message });
    }
  }

  return {
    provider: "Brevo",
    message: messageBody,
    translationProvider: translated.provider,
    results,
  };
};

const sendAlertNotifications = async ({
  channels,
  targets,
  message,
  targetLanguage = "en",
  emailSubject,
}) => {
  const selectedChannels = normalizeRecipients(channels)
    .map((item) => item.toLowerCase())
    .filter((item) => item === "email");
  const channelList = selectedChannels.length ? selectedChannels : ["email"];
  const response = {};
  let totalSent = 0;
  let totalFailed = 0;

  const registerResults = (key, data) => {
    response[key] = data;
    const successes = (data.results || []).filter((item) => !item.error).length;
    const failures = (data.results || []).filter((item) => item.error).length;
    totalSent += successes;
    totalFailed += failures;
  };

  for (const channel of channelList) {
    const recipients = normalizeRecipients(targets?.email);

    if (recipients.length === 0) {
      response.email = { status: "skipped", error: "No recipients provided.", results: [] };
      continue;
    }

    try {
      registerResults(
        "email",
        await sendEmailAlert({
          recipients,
          subject: emailSubject,
          body: message,
          targetLanguage,
        })
      );
    } catch (error) {
      response.email = { status: "failed", error: error.message, results: [] };
      totalFailed += recipients.length;
    }
  }

  return {
    channels: response,
    total_sent: totalSent,
    total_failed: totalFailed,
  };
};

module.exports = {
  sendAlertNotifications,
  normalizeRecipients,
};

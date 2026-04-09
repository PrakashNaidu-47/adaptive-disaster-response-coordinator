const axios = require("axios");

const createPagerDutyIncident = async ({ title, summary, urgency = "high" }) => {
  const apiKey = process.env.PAGERDUTY_API_KEY;
  const serviceId = process.env.PAGERDUTY_SERVICE_ID;
  const fromEmail = process.env.PAGERDUTY_FROM_EMAIL;

  if (!apiKey || !serviceId || !fromEmail) {
    throw new Error("PagerDuty credentials are not configured.");
  }

  const response = await axios.post(
    "https://api.pagerduty.com/incidents",
    {
      incident: {
        type: "incident",
        title,
        service: {
          id: serviceId,
          type: "service_reference",
        },
        urgency,
        body: {
          type: "incident_body",
          details: summary,
        },
      },
    },
    {
      headers: {
        Authorization: `Token token=${apiKey}`,
        Accept: "application/vnd.pagerduty+json;version=2",
        "Content-Type": "application/json",
        From: fromEmail,
      },
      timeout: 12000,
    }
  );

  const incident = response.data?.incident || {};
  return {
    provider: "PagerDuty",
    id: incident.id,
    status: incident.status,
    htmlUrl: incident.html_url,
    title: incident.title,
  };
};

module.exports = {
  createPagerDutyIncident,
};

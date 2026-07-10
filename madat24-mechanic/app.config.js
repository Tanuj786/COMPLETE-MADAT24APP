// Dynamic Expo config — see madat24-customer/app.config.js for explanation.

const fallback = "http://192.168.29.121:4000/api";

module.exports = ({ config }) => {
  const API_URL = process.env.API_URL || config.extra?.API_URL || fallback;
  const SENTRY_DSN = process.env.SENTRY_DSN || config.extra?.SENTRY_DSN || "";

  return {
    ...config,
    extra: {
      ...(config.extra || {}),
      API_URL,
      SENTRY_DSN,
      eas: config.extra?.eas,
    },
  };
};

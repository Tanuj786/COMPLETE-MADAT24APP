// Dynamic Expo config — see madat24-customer/app.config.js for explanation.

const base = require("./app.json");

const fallback = "http://192.168.1.14:4000/api";
const API_URL = process.env.API_URL || base.expo.extra?.API_URL || fallback;
const SENTRY_DSN = process.env.SENTRY_DSN || base.expo.extra?.SENTRY_DSN || "";

module.exports = {
  ...base,
  expo: {
    ...base.expo,
    extra: {
      ...(base.expo.extra || {}),
      API_URL,
      SENTRY_DSN,
      eas: base.expo.extra?.eas,
    },
  },
};

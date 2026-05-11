// Dynamic Expo config — reads API_URL from the environment so EAS build profiles
// can inject the right backend URL per build (dev / preview / production).
//
// Local dev: copy .env.example → .env and set API_URL=http://YOUR_PC_IP:4000/api
// EAS build: set API_URL in eas.json `env` block (per profile).

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
      eas: base.expo.extra?.eas,   // preserve EAS project linkage if present
    },
  },
};

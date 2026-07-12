// Dynamic Expo config — reads API_URL from the environment so EAS build profiles
// can inject the right backend URL per build (dev / preview / production).
//
// Local dev: copy .env.example → .env and set API_URL=http://YOUR_PC_IP:4000/api
// EAS build: set API_URL in eas.json `env` block (per profile).

const fallback = "https://complete-madat24app-1.onrender.com/api";

module.exports = ({ config }) => {
  const API_URL = process.env.API_URL || config.extra?.API_URL || fallback;
  const SENTRY_DSN = process.env.SENTRY_DSN || config.extra?.SENTRY_DSN || "";

  return {
    ...config,
    extra: {
      ...(config.extra || {}),
      API_URL,
      SENTRY_DSN,
      eas: config.extra?.eas,   // preserve EAS project linkage if present
    },
  };
};

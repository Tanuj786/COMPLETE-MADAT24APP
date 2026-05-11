const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Required for socket.io-client to resolve .cjs files
config.resolver.sourceExts.push("cjs");

// Required for socket.io-client to resolve browser/node dual packages
config.resolver.unstable_enablePackageExports = false;

// Fix: prevent socket.io crypto from using native module
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  crypto: require.resolve("expo-crypto"),
};

module.exports = config;

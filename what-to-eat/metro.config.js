// Sentry's wrapper adds debug ids so crash reports point at the right source lines.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);

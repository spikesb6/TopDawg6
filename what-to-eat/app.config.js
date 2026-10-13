// Adds Sentry's build plugin on top of app.json. Org and project come from the environment
// (SENTRY_ORG, SENTRY_PROJECT) so nothing account-specific lives in the repo.
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...config.plugins,
    [
      '@sentry/react-native/expo',
      {
        organization: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT ?? 'what-to-eat',
        url: 'https://sentry.io/',
      },
    ],
  ],
});

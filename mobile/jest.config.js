/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|expo-modules-core|@unimodules/.*|unimodules|sentry-expo|native-base|@sentry/.*|expo-router|drizzle-orm|react-native-gifted-charts|react-native-svg|react-native-qrcode-svg|lucide-react-native|@react-navigation/.*))',
  ],
};

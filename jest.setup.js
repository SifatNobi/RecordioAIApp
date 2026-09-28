/**
 * Jest environment setup.
 *
 * `expo-crypto` is a native module and has no JS implementation available under
 * Jest, so it is backed by Node's `crypto` here. This is a faithful stand-in
 * (real SHA-256, real hex output) and keeps the receipt integrity tests honest:
 * what is under test is the canonicalisation and tamper detection in
 * `src/services/receipt/integrity.ts`, not Expo's native bridge.
 */
jest.mock('expo-crypto', () => {
  const nodeCrypto = require('crypto');

  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    CryptoEncoding: { HEX: 'hex' },
    digestStringAsync: async (_algorithm, data, options) =>
      nodeCrypto
        .createHash('sha256')
        .update(data, 'utf8')
        .digest(options?.encoding ?? 'hex'),
  };
});

/**
 * The zustand store persists through AsyncStorage, which is a native module.
 * Use the mock AsyncStorage ships for Jest.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// @ts-check
import { jest } from '@jest/globals';
import EncryptionService from '../../src/services/EncryptionService.js';
import crypto from 'crypto';

// Mock console methods
console.log = jest.fn();
console.warn = jest.fn();
console.error = jest.fn();

describe('EncryptionService', () => {
  beforeEach(() => {
    // Reset the service state before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clear any timers or async operations
    jest.clearAllTimers();
  });

  afterAll(() => {
    // Ensure all handles are closed
    jest.restoreAllMocks();
  });

  describe('initialization', () => {
    test('should initialize with provided key', () => {
      const testKey = crypto.randomBytes(32).toString('base64');
      EncryptionService.initialize(testKey);
      
      // Test that encryption works (which indicates key was set)
      const testData = 'test-data';
      const encrypted = EncryptionService.encrypt(testData);
      const decrypted = EncryptionService.decrypt(encrypted);
      
      expect(decrypted).toBe(testData);
    });

    test('should generate key when none provided', () => {
      EncryptionService.initialize(null);
      
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('No encryption key provided, generating a new one')
      );
      expect(console.log).toHaveBeenCalledWith(
        'Generated encryption key:',
        expect.any(String)
      );
    });

    test('should work with generated key', () => {
      EncryptionService.initialize(null); // No key provided, will generate one
      
      const testData = 'test-with-generated-key';
      const encrypted = EncryptionService.encrypt(testData);
      const decrypted = EncryptionService.decrypt(encrypted);
      
      expect(decrypted).toBe(testData);
    });
  });

  describe('generateKey', () => {
    test('should generate valid 32-byte base64 key', () => {
      const key = EncryptionService.generateKey();
      
      expect(typeof key).toBe('string');
      
      // Decode and check length
      const keyBuffer = Buffer.from(key, 'base64');
      expect(keyBuffer.length).toBe(32);
    });

    test('should generate different keys each time', () => {
      const key1 = EncryptionService.generateKey();
      const key2 = EncryptionService.generateKey();
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('encryption and decryption', () => {
    beforeEach(() => {
      // Initialize with a known key for consistent testing
      const testKey = crypto.randomBytes(32).toString('base64');
      EncryptionService.initialize(testKey);
    });

    test('should encrypt and decrypt text correctly', () => {
      const plaintext = 'mySecretPassword123';
      const encrypted = EncryptionService.encrypt(plaintext);
      const decrypted = EncryptionService.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
      expect(encrypted).not.toBe(plaintext);
    });

    test('should handle empty string', () => {
      const encrypted = EncryptionService.encrypt('');
      expect(encrypted).toBe('');
      
      const decrypted = EncryptionService.decrypt('');
      expect(decrypted).toBe('');
    });

    test('should handle null/undefined input', () => {
      const encryptedNull = EncryptionService.encrypt(null);
      expect(encryptedNull).toBe('');
      
      const encryptedUndefined = EncryptionService.encrypt(undefined);
      expect(encryptedUndefined).toBe('');
    });

    test('should produce different encrypted values for same input (due to IV)', () => {
      const plaintext = 'same-input-text';
      const encrypted1 = EncryptionService.encrypt(plaintext);
      const encrypted2 = EncryptionService.encrypt(plaintext);
      
      expect(encrypted1).not.toBe(encrypted2);
      
      // But both should decrypt to same value
      expect(EncryptionService.decrypt(encrypted1)).toBe(plaintext);
      expect(EncryptionService.decrypt(encrypted2)).toBe(plaintext);
    });

    test('should use correct encryption format (IV:encrypted)', () => {
      const plaintext = 'test-format';
      const encrypted = EncryptionService.encrypt(plaintext);
      
      // Should be base64:base64 format
      expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$/);
      
      // Should contain exactly one colon separator
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(2);
    });

    test('should handle unicode characters', () => {
      const plaintext = 'Test with émojis 🔐 and ñ special chars';
      const encrypted = EncryptionService.encrypt(plaintext);
      const decrypted = EncryptionService.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    test('should handle long strings', () => {
      const plaintext = 'a'.repeat(1000);
      const encrypted = EncryptionService.encrypt(plaintext);
      const decrypted = EncryptionService.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('error handling', () => {
    test('should handle invalid encrypted data gracefully', () => {
      EncryptionService.initialize(crypto.randomBytes(32).toString('base64'));
      
      expect(() => EncryptionService.decrypt('invalid-data')).toThrow();
      expect(() => EncryptionService.decrypt('invalid:format:too:many:colons')).toThrow();
      expect(() => EncryptionService.decrypt('not-base64:also-not-base64')).toThrow();
    });

    test('should handle malformed IV:encrypted format', () => {
      EncryptionService.initialize(crypto.randomBytes(32).toString('base64'));
      
      expect(() => EncryptionService.decrypt('no-colon-separator')).toThrow();
      expect(() => EncryptionService.decrypt(':')).toThrow();
      expect(() => EncryptionService.decrypt('onlyiv:')).toThrow();
      expect(() => EncryptionService.decrypt(':onlyencrypted')).toThrow();
    });
  });

  describe('integration scenarios', () => {
    test('should maintain encryption across service reinitialization with same key', () => {
      const testKey = crypto.randomBytes(32).toString('base64');
      const plaintext = 'persistent-data';
      
      // First initialization and encryption
      EncryptionService.initialize(testKey);
      const encrypted = EncryptionService.encrypt(plaintext);
      
      // Reinitialize with same key
      EncryptionService.initialize(testKey);
      const decrypted = EncryptionService.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    test('should fail decryption with different key', () => {
      const plaintext = 'key-specific-data';
      
      // Encrypt with first key
      EncryptionService.initialize(crypto.randomBytes(32).toString('base64'));
      const encrypted = EncryptionService.encrypt(plaintext);
      
      // Try to decrypt with different key
      EncryptionService.initialize(crypto.randomBytes(32).toString('base64'));
      expect(() => EncryptionService.decrypt(encrypted)).toThrow();
    });
  });

  describe('round-trip testing (from test-encryption.js)', () => {
    test('should handle complete encryption workflow', () => {
      // Initialize with test key
      const testKey = EncryptionService.generateKey();
      EncryptionService.initialize(testKey);
      
      const testPassword = 'mySecretPassword123';
      const encrypted = EncryptionService.encrypt(testPassword);
      const decrypted = EncryptionService.decrypt(encrypted);
      
      expect(testPassword).toBe(decrypted);
      expect(encrypted).not.toBe(testPassword);
      expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$/);
    });
  });
});

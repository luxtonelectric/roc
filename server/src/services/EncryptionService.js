// @ts-check
import crypto from 'crypto';

/**
 * Service for encrypting and decrypting sensitive data
 * Uses AES-256-CBC encryption for secure password storage
 */
export default class EncryptionService {
  /** @type {string} */
  static #ALGORITHM = 'aes-256-cbc';
  
  /** @type {string} */
  static #ENCRYPTION_KEY;

  /**
   * Initialize the encryption service with a key
   * @param {string} key Base64 encoded encryption key
   */
  static initialize(key) {
    if (!key) {
      // Generate a new key if none provided (for development)
      console.warn('No encryption key provided, generating a new one. This should not happen in production!');
      EncryptionService.#ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
      console.log('Generated encryption key:', EncryptionService.#ENCRYPTION_KEY);
    } else {
      EncryptionService.#ENCRYPTION_KEY = key;
    }
  }

  /**
   * Get the encryption key, creating one if it doesn't exist
   * @returns {Uint8Array}
   */
  static #getKey() {
    if (!EncryptionService.#ENCRYPTION_KEY) {
      EncryptionService.initialize('');
    }
    return new Uint8Array(Buffer.from(EncryptionService.#ENCRYPTION_KEY, 'base64'));
  }

  /**
   * Encrypt a plaintext string
   * @param {string} plaintext The text to encrypt
   * @returns {string} Base64 encoded encrypted data with IV
   */
  static encrypt(plaintext) {
    console.log('Encrypting data...');
    if (!plaintext) {
      return '';
    }

    try {
      const key = EncryptionService.#getKey();
      const iv = new Uint8Array(crypto.randomBytes(16));
      const cipher = crypto.createCipheriv(EncryptionService.#ALGORITHM, key, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      // Combine IV and encrypted data
      const combined = Buffer.from(iv).toString('base64') + ':' + encrypted;

      return combined;
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt an encrypted string
   * @param {string} encryptedData Base64 encoded encrypted data with IV
   * @returns {string} The decrypted plaintext
   */
  static decrypt(encryptedData) {
    console.log('Decrypting data...');
    if (!encryptedData) {
      return '';
    }

    try {
      const key = EncryptionService.#getKey();
      const parts = encryptedData.split(':');
      
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = new Uint8Array(Buffer.from(parts[0], 'base64'));
      const encrypted = parts[1];

      const decipher = crypto.createDecipheriv(EncryptionService.#ALGORITHM, key, iv);
      
      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Check if a string appears to be encrypted
   * @param {string} data The data to check
   * @returns {boolean} True if the data appears to be encrypted
   */
  static isEncrypted(data) {
    if (!data || typeof data !== 'string') {
      return false;
    }

    // Check if it has the expected format: base64:base64
    const parts = data.split(':');
    if (parts.length !== 2) {
      return false;
    }

    // Check if both parts are valid base64
    const base64Regex = /^[A-Za-z0-9+/]+=*$/;
    return base64Regex.test(parts[0]) && base64Regex.test(parts[1]) && parts[0].length >= 22; // IV should be at least 16 bytes -> 22+ base64 chars
  }

  /**
   * Generate a new encryption key for configuration
   * @returns {string} Base64 encoded key
   */
  static generateKey() {
    return crypto.randomBytes(32).toString('base64');
  }
}

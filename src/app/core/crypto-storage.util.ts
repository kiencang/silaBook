import { openDB } from 'idb';

const SECURE_KEY_DB = 'secure_key_db';
const SECURE_STORE = 'keys';
const LOCAL_STORAGE_KEY_IV = 'api_key_iv';
const LOCAL_STORAGE_KEY_DATA = 'encrypted_api_key';
const OLD_LOCAL_STORAGE_KEY = 'user_gemini_api_key';

async function getDB() {
  return openDB(SECURE_KEY_DB, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(SECURE_STORE)) {
        db.createObjectStore(SECURE_STORE);
      }
    },
  });
}

/**
 * ArrayBuffer to Base64 String
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Base64 String to ArrayBuffer
 */
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Save API key securely using Web Crypto API + IndexedDB + LocalStorage
 */
export async function saveSecureApiKey(key: string): Promise<boolean> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    console.error('Web Crypto API is not supported in this environment.');
    return false;
  }

  try {
    // 1. Generate a random AES-GCM 256-bit key
    const cryptoKey = await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      false, // non-extractable!
      ['encrypt', 'decrypt']
    );

    // 2. Save the CryptoKey to IndexedDB
    const db = await getDB();
    await db.put(SECURE_STORE, cryptoKey, 'gemini_crypto_key');

    // 3. Generate a random IV
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // 4. Encrypt the API key
    const encodedKey = new TextEncoder().encode(key);
    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      cryptoKey,
      encodedKey
    );

    // 5. Save IV and Ciphertext to LocalStorage
    localStorage.setItem(LOCAL_STORAGE_KEY_IV, bufferToBase64(iv.buffer));
    localStorage.setItem(LOCAL_STORAGE_KEY_DATA, bufferToBase64(encryptedData));
    
    // Clean up the old plain text key if it exists
    localStorage.removeItem(OLD_LOCAL_STORAGE_KEY);
    
    return true;
  } catch (error) {
    console.error('Error saving secure API key:', error);
    return false;
  }
}

/**
 * Get and decrypt the securely stored API key
 */
export async function getSecureApiKey(): Promise<string | null> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    return null;
  }
  
  // 1. Check if we need to migrate an old plain text key
  const oldKey = localStorage.getItem(OLD_LOCAL_STORAGE_KEY);
  if (oldKey) {
    const success = await saveSecureApiKey(oldKey);
    if (success) {
      return oldKey;
    }
  }

  // 2. Read from LocalStorage
  const ivStr = localStorage.getItem(LOCAL_STORAGE_KEY_IV);
  const dataStr = localStorage.getItem(LOCAL_STORAGE_KEY_DATA);
  
  if (!ivStr || !dataStr) {
    return null;
  }

  try {
    // 3. Get CryptoKey from IndexedDB
    const db = await getDB();
    const cryptoKey = await db.get(SECURE_STORE, 'gemini_crypto_key');

    if (!cryptoKey) {
       // We have data but no key to decrypt it (perhaps IDB was cleared)
       await removeSecureApiKey();
       return null;
    }

    // 4. Decrypt
    const iv = new Uint8Array(base64ToBuffer(ivStr));
    const encryptedData = base64ToBuffer(dataStr);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      cryptoKey,
      encryptedData
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    console.error('Error decrypting secure API key:', error);
    // If decryption fails, the key is likely invalid or corrupted
    await removeSecureApiKey();
    return null;
  }
}

/**
 * Remove securely stored API key
 */
export async function removeSecureApiKey(): Promise<void> {
  // Clear LocalStorage
  localStorage.removeItem(LOCAL_STORAGE_KEY_IV);
  localStorage.removeItem(LOCAL_STORAGE_KEY_DATA);
  localStorage.removeItem(OLD_LOCAL_STORAGE_KEY);

  // Clear IndexedDB
  try {
    const db = await getDB();
    await db.delete(SECURE_STORE, 'gemini_crypto_key');
  } catch (error) {
    console.error('Error clearing secure key from IndexedDB:', error);
  }
}

/**
 * Check if a secure API key exists (without decrypting it)
 */
export async function hasSecureApiKey(): Promise<boolean> {
  // Return true if we have the new encrypted format OR the old plaintext format
  return (
    (!!localStorage.getItem(LOCAL_STORAGE_KEY_IV) && !!localStorage.getItem(LOCAL_STORAGE_KEY_DATA)) ||
    !!localStorage.getItem(OLD_LOCAL_STORAGE_KEY)
  );
}

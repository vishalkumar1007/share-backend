import { customAlphabet } from 'nanoid';

const SHARE_ALPHABET = '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMERIC_ALPHABET = '1234567890';
const ROOM_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

const nanoidShare = customAlphabet(SHARE_ALPHABET, 12);
const nanoidNumeric = customAlphabet(NUMERIC_ALPHABET, 6);
const nanoidRoom = customAlphabet(ROOM_ALPHABET, 6);

export const generateShareId = () => nanoidShare();

export const generateNumericCode = () => nanoidNumeric();

export const generateRoomCode = () => nanoidRoom();

export const isDuplicateKeyError = (error) => error?.code === 11000;

/**
 * Generates a code and runs `attempt(code)`, retrying when the code collides
 * with an existing document (MongoDB unique index). This is safe on stateless
 * serverless functions where multiple instances run in parallel.
 */
export const withUniqueCode = async (generate, attempt, maxAttempts = 5) => {
  let lastError;
  for (let i = 0; i < maxAttempts; i++) {
    const code = generate();
    try {
      return await attempt(code);
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      lastError = error;
    }
  }
  throw lastError;
};

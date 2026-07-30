import * as crypto from 'crypto';
const ALGORITHM = 'aes-256-cbc';
export const encrypt = (
  data: unknown,
  aesKey: string,
): string => {
  const key = Buffer.from(aesKey, 'hex');

  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(
    ALGORITHM,
    key,
    iv,
  );

  let encrypted = cipher.update(
    JSON.stringify(data),
    'utf8',
    'hex',
  );

  encrypted += cipher.final('hex');

  return `${iv.toString('hex')}:${encrypted}`;
};

/** Decrypts values produced by `encrypt`. The caller is responsible for
 * handling invalid/legacy ciphertext safely. */
export const decrypt = (encryptedData: string, aesKey: string): unknown => {
  const key = Buffer.from(aesKey, 'hex');
  const [ivHex, ciphertext] = encryptedData.split(':');

  if (!ivHex || !ciphertext) {
    throw new Error('Invalid encrypted message format.');
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivHex, 'hex'),
  );

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
};

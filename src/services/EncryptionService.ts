import * as crypto from "crypto";
import { IConfigService } from "./ConfigService";
import { ApplicationError, ErrorType } from "./ErrorHandler";

/* eslint-disable no-unused-vars */
export interface IEncryptionService {
  encrypt(plaintext: string): string;
  decrypt(encryptedData: string): string;
  hash(data: string, salt?: string): { hash: string; salt: string };
  verifyHash(data: string, hash: string, salt: string): boolean;
  generateSecureToken(length?: number): string;
  generateEncryptionKey(): string;
  createSignature(data: string, secret?: string): string;
  verifySignature(data: string, signature: string, secret?: string): boolean;
  maskSensitiveData(data: string, visibleChars: number): string;
}
/* eslint-enable no-unused-vars */

export class EncryptionService implements IEncryptionService {
  private static readonly ALGORITHM = "aes-256-gcm";
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 16; // 128 bits
  private static readonly TAG_LENGTH = 16; // 128 bits

  private readonly encryptionKey: Buffer;

  constructor(configService: IConfigService) {
    const secretKey = configService.getEncryptionSecretKey();

    if (secretKey) {
      // Derive key from provided secret
      this.encryptionKey = crypto.scryptSync(
        secretKey,
        "salt",
        EncryptionService.KEY_LENGTH
      );
    } else {
      // Generate random key (for development/testing)
      this.encryptionKey = crypto.randomBytes(EncryptionService.KEY_LENGTH);
    }
  }

  /**
   * Encrypt sensitive data (like API tokens)
   */
  encrypt(plaintext: string): string {
    try {
      const iv = crypto.randomBytes(EncryptionService.IV_LENGTH);
      const cipher = crypto.createCipheriv(
        EncryptionService.ALGORITHM,
        this.encryptionKey,
        iv
      );
      cipher.setAAD(Buffer.from("jira-discord-bot"));

      let encrypted = cipher.update(plaintext, "utf8", "hex");
      encrypted += cipher.final("hex");

      const tag = cipher.getAuthTag();

      // Combine IV, tag, and encrypted data
      const combined = Buffer.concat([iv, tag, Buffer.from(encrypted, "hex")]);
      return combined.toString("base64");
    } catch (error) {
      throw new ApplicationError(
        "Failed to encrypt data",
        ErrorType.UNKNOWN_ERROR,
        false,
        undefined,
        {
          originalError: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: string): string {
    try {
      const combined = Buffer.from(encryptedData, "base64");

      const iv = combined.subarray(0, EncryptionService.IV_LENGTH);
      const tag = combined.subarray(
        EncryptionService.IV_LENGTH,
        EncryptionService.IV_LENGTH + EncryptionService.TAG_LENGTH
      );
      const encrypted = combined.subarray(
        EncryptionService.IV_LENGTH + EncryptionService.TAG_LENGTH
      );

      const decipher = crypto.createDecipheriv(
        EncryptionService.ALGORITHM,
        this.encryptionKey,
        iv
      );
      decipher.setAAD(Buffer.from("jira-discord-bot"));
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, undefined, "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      throw new ApplicationError(
        "Failed to decrypt data - data may be corrupted or key may be incorrect",
        ErrorType.UNKNOWN_ERROR,
        false,
        undefined,
        {
          originalError: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * Hash sensitive data for comparison (passwords, etc.)
   */
  hash(data: string, salt?: string): { hash: string; salt: string } {
    const actualSalt = salt || crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(data, actualSalt, 64).toString("hex");

    return { hash, salt: actualSalt };
  }

  /**
   * Verify hashed data
   */
  verifyHash(data: string, hash: string, salt: string): boolean {
    const verifyHash = crypto.scryptSync(data, salt, 64).toString("hex");
    return crypto.timingSafeEqual(
      Buffer.from(hash, "hex"),
      Buffer.from(verifyHash, "hex")
    );
  }

  /**
   * Generate a secure random token
   */
  generateSecureToken(length = 32): string {
    return crypto.randomBytes(length).toString("hex");
  }

  /**
   * Generate a secure random key for encryption
   */
  generateEncryptionKey(): string {
    return crypto.randomBytes(EncryptionService.KEY_LENGTH).toString("hex");
  }

  /**
   * Create HMAC signature for data integrity
   */
  createSignature(data: string, secret?: string): string {
    const hmacSecret = secret || this.encryptionKey.toString("hex");
    return crypto.createHmac("sha256", hmacSecret).update(data).digest("hex");
  }

  /**
   * Verify HMAC signature
   */
  verifySignature(data: string, signature: string, secret?: string): boolean {
    const hmacSecret = secret || this.encryptionKey.toString("hex");
    const expectedSignature = crypto
      .createHmac("sha256", hmacSecret)
      .update(data)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  }

  /**
   * Mask sensitive data for logging
   */
  maskSensitiveData(data: string, visibleChars = 4): string {
    if (data.length <= visibleChars * 2) {
      return "*".repeat(data.length);
    }

    const start = data.substring(0, visibleChars);
    const end = data.substring(data.length - visibleChars);
    const middle = "*".repeat(data.length - visibleChars * 2);

    return `${start}${middle}${end}`;
  }
}

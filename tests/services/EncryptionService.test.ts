import { EncryptionService } from "../../src/services/EncryptionService";
import { ApplicationError, ErrorType } from "../../src/services/ErrorHandler";

describe("EncryptionService", () => {
  let encryptionService: EncryptionService;
  const testSecret = "test-secret-key-for-testing";
  const testData = "sensitive-test-data";

  beforeEach(() => {
    encryptionService = new EncryptionService(testSecret);
  });

  describe("constructor", () => {
    it("should create instance with provided secret key", () => {
      const service = new EncryptionService(testSecret);
      expect(service).toBeInstanceOf(EncryptionService);
    });

    it("should create instance without secret key (random key)", () => {
      const service = new EncryptionService();
      expect(service).toBeInstanceOf(EncryptionService);
    });

    it("should create different instances with different keys", () => {
      const service1 = new EncryptionService("key1");
      const service2 = new EncryptionService("key2");

      const encrypted1 = service1.encrypt(testData);
      const encrypted2 = service2.encrypt(testData);

      // Should not be able to decrypt with wrong key
      expect(() => service1.decrypt(encrypted2)).toThrow(ApplicationError);
      expect(() => service2.decrypt(encrypted1)).toThrow(ApplicationError);
    });
  });

  describe("encrypt", () => {
    it("should encrypt plaintext successfully", () => {
      const encrypted = encryptionService.encrypt(testData);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe("string");
      expect(encrypted).not.toBe(testData);
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it("should produce different encrypted outputs for same input", () => {
      const encrypted1 = encryptionService.encrypt(testData);
      const encrypted2 = encryptionService.encrypt(testData);

      // Should be different due to random IV
      expect(encrypted1).not.toBe(encrypted2);
    });

    it("should encrypt empty string", () => {
      const encrypted = encryptionService.encrypt("");
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe("string");
    });

    it("should encrypt special characters and unicode", () => {
      const specialData = "!@#$%^&*()_+{}|:<>?[]\\;'\",./ 🔐🚀";
      const encrypted = encryptionService.encrypt(specialData);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe("string");
    });

    it("should handle very long strings", () => {
      const longData = "a".repeat(10000);
      const encrypted = encryptionService.encrypt(longData);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe("string");
    });
  });

  describe("decrypt", () => {
    it("should decrypt encrypted data successfully", () => {
      const encrypted = encryptionService.encrypt(testData);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(testData);
    });

    it("should decrypt empty string", () => {
      const encrypted = encryptionService.encrypt("");
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe("");
    });

    it("should decrypt special characters and unicode", () => {
      const specialData = "!@#$%^&*()_+{}|:<>?[]\\;'\",./ 🔐🚀";
      const encrypted = encryptionService.encrypt(specialData);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(specialData);
    });

    it("should decrypt very long strings", () => {
      const longData = "a".repeat(10000);
      const encrypted = encryptionService.encrypt(longData);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(longData);
    });

    it("should throw error for invalid encrypted data", () => {
      expect(() => encryptionService.decrypt("invalid-data")).toThrow(
        ApplicationError
      );
    });

    it("should throw error for corrupted encrypted data", () => {
      const encrypted = encryptionService.encrypt(testData);
      const corrupted = encrypted.slice(0, -5) + "xxxxx";

      expect(() => encryptionService.decrypt(corrupted)).toThrow(
        ApplicationError
      );
    });

    it("should throw error for truncated encrypted data", () => {
      const encrypted = encryptionService.encrypt(testData);
      const truncated = encrypted.slice(0, 10);

      expect(() => encryptionService.decrypt(truncated)).toThrow(
        ApplicationError
      );
    });

    it("should throw ApplicationError with correct error type", () => {
      try {
        encryptionService.decrypt("invalid-base64-data!");
      } catch (error) {
        expect(error).toBeInstanceOf(ApplicationError);
        expect((error as ApplicationError).type).toBe(ErrorType.UNKNOWN_ERROR);
        expect((error as ApplicationError).message).toContain(
          "Failed to decrypt data"
        );
      }
    });
  });

  describe("hash", () => {
    it("should create hash with generated salt", () => {
      const result = encryptionService.hash(testData);

      expect(result).toHaveProperty("hash");
      expect(result).toHaveProperty("salt");
      expect(typeof result.hash).toBe("string");
      expect(typeof result.salt).toBe("string");
      expect(result.hash.length).toBeGreaterThan(0);
      expect(result.salt.length).toBeGreaterThan(0);
    });

    it("should create hash with provided salt", () => {
      const providedSalt = "my-custom-salt";
      const result = encryptionService.hash(testData, providedSalt);

      expect(result.salt).toBe(providedSalt);
      expect(result.hash).toBeDefined();
    });

    it("should produce same hash for same data and salt", () => {
      const salt = "consistent-salt";
      const result1 = encryptionService.hash(testData, salt);
      const result2 = encryptionService.hash(testData, salt);

      expect(result1.hash).toBe(result2.hash);
      expect(result1.salt).toBe(result2.salt);
    });

    it("should produce different hashes for same data with different salts", () => {
      const result1 = encryptionService.hash(testData);
      const result2 = encryptionService.hash(testData);

      expect(result1.hash).not.toBe(result2.hash);
      expect(result1.salt).not.toBe(result2.salt);
    });

    it("should handle empty string", () => {
      const result = encryptionService.hash("");

      expect(result.hash).toBeDefined();
      expect(result.salt).toBeDefined();
    });
  });

  describe("verifyHash", () => {
    it("should verify correct hash", () => {
      const { hash, salt } = encryptionService.hash(testData);
      const isValid = encryptionService.verifyHash(testData, hash, salt);

      expect(isValid).toBe(true);
    });

    it("should reject incorrect data", () => {
      const { hash, salt } = encryptionService.hash(testData);
      const isValid = encryptionService.verifyHash("wrong-data", hash, salt);

      expect(isValid).toBe(false);
    });

    it("should reject incorrect hash", () => {
      const { salt } = encryptionService.hash(testData);

      // Create a hash with the same length but different content
      const correctHash = encryptionService.hash(testData, salt).hash;
      const wrongHash = correctHash.slice(0, -2) + "ff"; // Change last 2 chars but keep length

      const isValid = encryptionService.verifyHash(testData, wrongHash, salt);

      expect(isValid).toBe(false);
    });

    it("should reject incorrect salt", () => {
      const { hash } = encryptionService.hash(testData);
      const isValid = encryptionService.verifyHash(
        testData,
        hash,
        "wrong-salt"
      );

      expect(isValid).toBe(false);
    });

    it("should handle empty strings", () => {
      const { hash, salt } = encryptionService.hash("");
      const isValid = encryptionService.verifyHash("", hash, salt);

      expect(isValid).toBe(true);
    });
  });

  describe("generateSecureToken", () => {
    it("should generate token with default length", () => {
      const token = encryptionService.generateSecureToken();

      expect(typeof token).toBe("string");
      expect(token.length).toBe(64); // 32 bytes * 2 (hex)
    });

    it("should generate token with custom length", () => {
      const length = 16;
      const token = encryptionService.generateSecureToken(length);

      expect(typeof token).toBe("string");
      expect(token.length).toBe(length * 2); // length * 2 (hex)
    });

    it("should generate different tokens on each call", () => {
      const token1 = encryptionService.generateSecureToken();
      const token2 = encryptionService.generateSecureToken();

      expect(token1).not.toBe(token2);
    });

    it("should generate valid hex string", () => {
      const token = encryptionService.generateSecureToken();

      expect(/^[0-9a-f]+$/i.test(token)).toBe(true);
    });
  });

  describe("generateEncryptionKey", () => {
    it("should generate encryption key", () => {
      const key = encryptionService.generateEncryptionKey();

      expect(typeof key).toBe("string");
      expect(key.length).toBe(64); // 32 bytes * 2 (hex)
    });

    it("should generate different keys on each call", () => {
      const key1 = encryptionService.generateEncryptionKey();
      const key2 = encryptionService.generateEncryptionKey();

      expect(key1).not.toBe(key2);
    });

    it("should generate valid hex string", () => {
      const key = encryptionService.generateEncryptionKey();

      expect(/^[0-9a-f]+$/i.test(key)).toBe(true);
    });
  });

  describe("createSignature", () => {
    it("should create signature with default secret", () => {
      const signature = encryptionService.createSignature(testData);

      expect(typeof signature).toBe("string");
      expect(signature.length).toBeGreaterThan(0);
      expect(/^[0-9a-f]+$/i.test(signature)).toBe(true);
    });

    it("should create signature with custom secret", () => {
      const customSecret = "custom-secret";
      const signature = encryptionService.createSignature(
        testData,
        customSecret
      );

      expect(typeof signature).toBe("string");
      expect(signature.length).toBeGreaterThan(0);
    });

    it("should produce consistent signatures for same data and secret", () => {
      const signature1 = encryptionService.createSignature(testData);
      const signature2 = encryptionService.createSignature(testData);

      expect(signature1).toBe(signature2);
    });

    it("should produce different signatures for different data", () => {
      const signature1 = encryptionService.createSignature("data1");
      const signature2 = encryptionService.createSignature("data2");

      expect(signature1).not.toBe(signature2);
    });

    it("should handle empty string", () => {
      const signature = encryptionService.createSignature("");

      expect(typeof signature).toBe("string");
      expect(signature.length).toBeGreaterThan(0);
    });
  });

  describe("verifySignature", () => {
    it("should verify correct signature with default secret", () => {
      const signature = encryptionService.createSignature(testData);
      const isValid = encryptionService.verifySignature(testData, signature);

      expect(isValid).toBe(true);
    });

    it("should verify correct signature with custom secret", () => {
      const customSecret = "custom-secret";
      const signature = encryptionService.createSignature(
        testData,
        customSecret
      );
      const isValid = encryptionService.verifySignature(
        testData,
        signature,
        customSecret
      );

      expect(isValid).toBe(true);
    });

    it("should reject incorrect signature", () => {
      const signature = encryptionService.createSignature(testData);
      const isValid = encryptionService.verifySignature(
        "wrong-data",
        signature
      );

      expect(isValid).toBe(false);
    });

    it("should reject signature with wrong secret", () => {
      const signature = encryptionService.createSignature(testData, "secret1");
      const isValid = encryptionService.verifySignature(
        testData,
        signature,
        "secret2"
      );

      expect(isValid).toBe(false);
    });

    it("should handle empty strings", () => {
      const signature = encryptionService.createSignature("");
      const isValid = encryptionService.verifySignature("", signature);

      expect(isValid).toBe(true);
    });
  });

  describe("maskSensitiveData", () => {
    it("should mask data with default visible chars", () => {
      const data = "1234567890abcdef"; // 16 chars
      const masked = encryptionService.maskSensitiveData(data);

      // With 4 visible chars on each side: "1234" + 8 stars + "cdef"
      expect(masked).toBe("1234********cdef");
    });

    it("should mask data with custom visible chars", () => {
      const data = "1234567890abcdef"; // 16 chars
      const masked = encryptionService.maskSensitiveData(data, 2);

      // With 2 visible chars on each side: "12" + 12 stars + "ef"
      expect(masked).toBe("12************ef");
    });

    it("should mask short data completely", () => {
      const data = "123";
      const masked = encryptionService.maskSensitiveData(data);

      expect(masked).toBe("***");
    });

    it("should handle data equal to visible chars * 2", () => {
      const data = "12345678"; // 8 chars, 4 visible * 2
      const masked = encryptionService.maskSensitiveData(data, 4);

      expect(masked).toBe("********");
    });

    it("should handle empty string", () => {
      const masked = encryptionService.maskSensitiveData("");

      expect(masked).toBe("");
    });

    it("should handle single character", () => {
      const masked = encryptionService.maskSensitiveData("a");

      expect(masked).toBe("*");
    });

    it("should handle visible chars larger than string", () => {
      const data = "abc";
      const masked = encryptionService.maskSensitiveData(data, 10);

      expect(masked).toBe("***");
    });
  });

  describe("encryption/decryption round-trip", () => {
    it("should successfully encrypt and decrypt multiple times", () => {
      let data = testData;

      for (let i = 0; i < 10; i++) {
        const encrypted = encryptionService.encrypt(data);
        const decrypted = encryptionService.decrypt(encrypted);
        expect(decrypted).toBe(data);
        data = decrypted + i; // Vary the data
      }
    });

    it("should handle concurrent encryption/decryption", async () => {
      const promises = Array.from({ length: 100 }, (_, i) => {
        return Promise.resolve().then(() => {
          const data = `test-data-${i}`;
          const encrypted = encryptionService.encrypt(data);
          const decrypted = encryptionService.decrypt(encrypted);
          expect(decrypted).toBe(data);
        });
      });

      await Promise.all(promises);
    });
  });

  describe("error handling", () => {
    it("should handle invalid base64 input for decryption", () => {
      expect(() => encryptionService.decrypt("not-valid-base64!@#$")).toThrow(
        ApplicationError
      );
    });

    it("should handle empty encrypted data", () => {
      expect(() => encryptionService.decrypt("")).toThrow(ApplicationError);
    });

    it("should throw ApplicationError with proper error details", () => {
      try {
        encryptionService.decrypt("invalid-encrypted-data");
      } catch (error) {
        expect(error).toBeInstanceOf(ApplicationError);
        expect((error as ApplicationError).type).toBe(ErrorType.UNKNOWN_ERROR);
        expect((error as ApplicationError).message).toContain(
          "Failed to decrypt data"
        );
        expect((error as ApplicationError).details).toBeDefined();
        expect(
          (error as ApplicationError).details?.originalError
        ).toBeDefined();
      }
    });
  });
});

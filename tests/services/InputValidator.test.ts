import { ApplicationError, ErrorType } from "../../src/services/ErrorHandler";
import {
  InputValidator,
  ValidationError,
} from "../../src/services/InputValidator";

describe("InputValidator", () => {
  describe("ValidationError", () => {
    it("should create ValidationError with field name", () => {
      const error = new ValidationError("is invalid", "username");

      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toBeInstanceOf(ApplicationError);
      expect(error.message).toBe("username: is invalid");
      expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(error.name).toBe("ValidationError");
    });

    it("should create ValidationError without field name", () => {
      const error = new ValidationError("Something is wrong");

      expect(error.message).toBe("Something is wrong");
      expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
    });
  });

  describe("validateString", () => {
    it("should validate valid string", () => {
      const result = InputValidator.validateString("hello", "test", {
        required: true,
        minLength: 3,
        maxLength: 10,
      });

      expect(result).toBe("hello");
    });

    it("should trim whitespace", () => {
      const result = InputValidator.validateString("  hello  ", "test", {
        required: true,
      });

      expect(result).toBe("hello");
    });

    it("should return empty string for optional null/undefined", () => {
      expect(
        InputValidator.validateString(null, "test", { required: false })
      ).toBe("");
      expect(
        InputValidator.validateString(undefined, "test", { required: false })
      ).toBe("");
    });

    it("should throw error for required null/undefined", () => {
      expect(() =>
        InputValidator.validateString(null, "test", { required: true })
      ).toThrow(ValidationError);

      expect(() =>
        InputValidator.validateString(undefined, "test", { required: true })
      ).toThrow(ValidationError);
    });

    it("should throw error for non-string values", () => {
      expect(() => InputValidator.validateString(123, "test")).toThrow(
        ValidationError
      );

      expect(() => InputValidator.validateString(true, "test")).toThrow(
        ValidationError
      );

      expect(() => InputValidator.validateString([], "test")).toThrow(
        ValidationError
      );
    });

    it("should throw error for empty required string", () => {
      expect(() =>
        InputValidator.validateString("", "test", { required: true })
      ).toThrow(ValidationError);

      expect(() =>
        InputValidator.validateString("   ", "test", { required: true })
      ).toThrow(ValidationError);
    });

    it("should validate minimum length", () => {
      expect(() =>
        InputValidator.validateString("hi", "test", { minLength: 5 })
      ).toThrow(ValidationError);
    });

    it("should validate maximum length", () => {
      expect(() =>
        InputValidator.validateString("toolongstring", "test", { maxLength: 5 })
      ).toThrow(ValidationError);
    });

    it("should validate pattern", () => {
      const pattern = /^[a-z]+$/;

      expect(InputValidator.validateString("hello", "test", { pattern })).toBe(
        "hello"
      );

      expect(() =>
        InputValidator.validateString("Hello123", "test", { pattern })
      ).toThrow(ValidationError);
    });

    it("should handle default options", () => {
      expect(InputValidator.validateString("test", "field")).toBe("test");
    });
  });

  describe("validateNumber", () => {
    it("should validate valid numbers", () => {
      expect(InputValidator.validateNumber(42, "test")).toBe(42);
      expect(InputValidator.validateNumber("42", "test")).toBe(42);
      expect(InputValidator.validateNumber(3.14, "test")).toBe(3.14);
    });

    it("should return 0 for optional null/undefined", () => {
      expect(
        InputValidator.validateNumber(null, "test", { required: false })
      ).toBe(0);
      expect(
        InputValidator.validateNumber(undefined, "test", { required: false })
      ).toBe(0);
    });

    it("should throw error for required null/undefined", () => {
      expect(() =>
        InputValidator.validateNumber(null, "test", { required: true })
      ).toThrow(ValidationError);

      expect(() =>
        InputValidator.validateNumber(undefined, "test", { required: true })
      ).toThrow(ValidationError);
    });

    it("should throw error for invalid numbers", () => {
      expect(() =>
        InputValidator.validateNumber("not-a-number", "test")
      ).toThrow(ValidationError);

      // Empty string converts to 0, which is valid
      expect(InputValidator.validateNumber("", "test")).toBe(0);

      expect(() => InputValidator.validateNumber(NaN, "test")).toThrow(
        ValidationError
      );
    });

    it("should validate integer requirement", () => {
      expect(InputValidator.validateNumber(42, "test", { integer: true })).toBe(
        42
      );

      expect(() =>
        InputValidator.validateNumber(3.14, "test", { integer: true })
      ).toThrow(ValidationError);
    });

    it("should validate minimum value", () => {
      expect(() =>
        InputValidator.validateNumber(5, "test", { min: 10 })
      ).toThrow(ValidationError);
    });

    it("should validate maximum value", () => {
      expect(() =>
        InputValidator.validateNumber(15, "test", { max: 10 })
      ).toThrow(ValidationError);
    });

    it("should handle edge cases", () => {
      expect(InputValidator.validateNumber(0, "test")).toBe(0);
      expect(InputValidator.validateNumber(-5, "test")).toBe(-5);
      expect(InputValidator.validateNumber(Infinity, "test")).toBe(Infinity);
    });
  });

  describe("validateJiraHost", () => {
    it("should validate valid Jira hosts", () => {
      expect(InputValidator.validateJiraHost("company.atlassian.net")).toBe(
        "company.atlassian.net"
      );

      expect(
        InputValidator.validateJiraHost("https://company.atlassian.net")
      ).toBe("company.atlassian.net");

      expect(InputValidator.validateJiraHost("http://jira.company.com")).toBe(
        "jira.company.com"
      );
    });

    it("should remove protocol from host", () => {
      expect(InputValidator.validateJiraHost("https://example.com")).toBe(
        "example.com"
      );

      expect(InputValidator.validateJiraHost("http://example.com")).toBe(
        "example.com"
      );
    });

    it("should throw error for invalid hosts", () => {
      expect(() => InputValidator.validateJiraHost("")).toThrow(
        ValidationError
      );

      expect(() => InputValidator.validateJiraHost("invalid")).toThrow(
        ValidationError
      );

      expect(() => InputValidator.validateJiraHost("..invalid..")).toThrow(
        ValidationError
      );

      expect(() => InputValidator.validateJiraHost("spaces in host")).toThrow(
        ValidationError
      );
    });

    it("should validate domain patterns", () => {
      expect(InputValidator.validateJiraHost("valid-domain.com")).toBe(
        "valid-domain.com"
      );

      expect(InputValidator.validateJiraHost("sub.domain.com")).toBe(
        "sub.domain.com"
      );
    });

    it("should handle edge cases", () => {
      // Very long but valid domain
      const longDomain = "a".repeat(50) + ".atlassian.net";
      expect(InputValidator.validateJiraHost(longDomain)).toBe(longDomain);
    });
  });

  describe("validateEmail", () => {
    it("should validate valid emails", () => {
      expect(InputValidator.validateEmail("user@example.com")).toBe(
        "user@example.com"
      );

      expect(InputValidator.validateEmail("User@Example.COM")).toBe(
        "user@example.com"
      );
    });

    it("should throw error for invalid emails", () => {
      expect(() => InputValidator.validateEmail("")).toThrow(ValidationError);

      expect(() => InputValidator.validateEmail("invalid")).toThrow(
        ValidationError
      );

      expect(() => InputValidator.validateEmail("@example.com")).toThrow(
        ValidationError
      );

      expect(() => InputValidator.validateEmail("user@")).toThrow(
        ValidationError
      );

      expect(() => InputValidator.validateEmail("user@.com")).toThrow(
        ValidationError
      );

      expect(() => InputValidator.validateEmail("user@example")).toThrow(
        ValidationError
      );
    });

    it("should convert to lowercase", () => {
      expect(InputValidator.validateEmail("Test@EXAMPLE.COM")).toBe(
        "test@example.com"
      );
    });

    it("should handle complex but valid emails", () => {
      expect(InputValidator.validateEmail("user+tag@sub.domain.co.uk")).toBe(
        "user+tag@sub.domain.co.uk"
      );
    });
  });

  describe("validateApiToken", () => {
    it("should validate valid API tokens", () => {
      const token = "abcdef123456789";
      expect(InputValidator.validateApiToken(token)).toBe(token);
    });

    it("should throw error for invalid tokens", () => {
      expect(() => InputValidator.validateApiToken("")).toThrow(
        ValidationError
      );

      expect(() => InputValidator.validateApiToken("short")).toThrow(
        ValidationError
      );

      expect(() =>
        InputValidator.validateApiToken("token with spaces")
      ).toThrow(ValidationError);

      expect(() =>
        InputValidator.validateApiToken("token\nwith\nnewlines")
      ).toThrow(ValidationError);

      expect(() =>
        InputValidator.validateApiToken("token\twith\ttabs")
      ).toThrow(ValidationError);
    });

    it("should handle long tokens", () => {
      const longToken = "a".repeat(100);
      expect(InputValidator.validateApiToken(longToken)).toBe(longToken);
    });

    it("should reject very long tokens", () => {
      const veryLongToken = "a".repeat(600);
      expect(() => InputValidator.validateApiToken(veryLongToken)).toThrow(
        ValidationError
      );
    });
  });

  describe("validateJQL", () => {
    it("should validate valid JQL queries", () => {
      const jql = "assignee = currentUser() AND status = 'In Progress'";
      expect(InputValidator.validateJQL(jql)).toBe(jql);
    });

    it("should return undefined for empty/null JQL", () => {
      expect(InputValidator.validateJQL("")).toBeUndefined();
      expect(InputValidator.validateJQL(undefined)).toBeUndefined();
    });

    it("should validate JQL keywords", () => {
      expect(InputValidator.validateJQL("project = TEST")).toBe(
        "project = TEST"
      );
      expect(InputValidator.validateJQL("status WAS 'Done'")).toBe(
        "status WAS 'Done'"
      );
      expect(InputValidator.validateJQL("created >= -7d")).toBe(
        "created >= -7d"
      );
    });

    it("should throw error for queries without JQL keywords", () => {
      expect(() => InputValidator.validateJQL("hello world")).toThrow(
        ValidationError
      );

      expect(() => InputValidator.validateJQL("123456")).toThrow(
        ValidationError
      );
    });

    it("should validate length limits", () => {
      expect(() => InputValidator.validateJQL("a")).toThrow(ValidationError);

      const longJql = "project = TEST AND ".repeat(100);
      expect(() => InputValidator.validateJQL(longJql)).toThrow(
        ValidationError
      );
    });
  });

  describe("validateDailyHours", () => {
    it("should validate valid hours", () => {
      expect(InputValidator.validateDailyHours(8)).toBe(8);
      expect(InputValidator.validateDailyHours("8")).toBe(8);
    });

    it("should return default value for invalid input", () => {
      expect(InputValidator.validateDailyHours(null)).toBe(8);
      expect(InputValidator.validateDailyHours(undefined)).toBe(8);
      // Note: 0 is invalid (below minimum) so it throws an error rather than returning default
    });

    it("should validate range limits", () => {
      expect(() => InputValidator.validateDailyHours(0)).toThrow(
        ValidationError
      );

      expect(() => InputValidator.validateDailyHours(25)).toThrow(
        ValidationError
      );
    });

    it("should require integer values", () => {
      expect(() => InputValidator.validateDailyHours(8.5)).toThrow(
        ValidationError
      );
    });

    it("should handle edge cases", () => {
      expect(InputValidator.validateDailyHours(1)).toBe(1);
      expect(InputValidator.validateDailyHours(24)).toBe(24);
    });
  });

  describe("sanitizeInput", () => {
    it("should remove dangerous characters", () => {
      expect(
        InputValidator.sanitizeInput("<script>alert('xss')</script>")
      ).toBe("scriptalert(xss)/script");

      expect(
        InputValidator.sanitizeInput("SELECT * FROM users WHERE id='1'")
      ).toBe("SELECT * FROM users WHERE id=1");
    });

    it("should remove control characters", () => {
      expect(InputValidator.sanitizeInput("test\u0000\u0001\u0002")).toBe(
        "test"
      );
    });

    it("should trim whitespace", () => {
      expect(InputValidator.sanitizeInput("  hello world  ")).toBe(
        "hello world"
      );
    });

    it("should handle empty strings", () => {
      expect(InputValidator.sanitizeInput("")).toBe("");
    });

    it("should preserve normal characters", () => {
      expect(InputValidator.sanitizeInput("Normal text 123!@#$%^&*()")).toBe(
        "Normal text 123!@#$%^&*()"
      );
    });
  });

  describe("validateDiscordId", () => {
    it("should validate valid Discord IDs", () => {
      const validId = "123456789012345678";
      expect(InputValidator.validateDiscordId(validId, "User ID")).toBe(
        validId
      );
    });

    it("should throw error for invalid lengths", () => {
      expect(() =>
        InputValidator.validateDiscordId("12345", "User ID")
      ).toThrow(ValidationError);

      expect(() =>
        InputValidator.validateDiscordId("12345678901234567890", "User ID")
      ).toThrow(ValidationError);
    });

    it("should throw error for non-digit characters", () => {
      expect(() =>
        InputValidator.validateDiscordId("12345678901234567a", "User ID")
      ).toThrow(ValidationError);

      expect(() =>
        InputValidator.validateDiscordId("123456789012345-67", "User ID")
      ).toThrow(ValidationError);
    });

    it("should handle different field names", () => {
      try {
        InputValidator.validateDiscordId("invalid", "Guild ID");
      } catch (error) {
        expect((error as ValidationError).message).toContain("Guild ID");
      }
    });
  });

  describe("validateRateLimit", () => {
    let attempts: Map<string, { count: number; resetTime: number }>;

    beforeEach(() => {
      attempts = new Map();
    });

    it("should allow first attempt", () => {
      expect(() =>
        InputValidator.validateRateLimit(
          "user123",
          "action",
          5,
          60000,
          attempts
        )
      ).not.toThrow();

      expect(attempts.get("user123:action")).toEqual({
        count: 1,
        resetTime: expect.any(Number),
      });
    });

    it("should track multiple attempts", () => {
      // First attempt
      InputValidator.validateRateLimit("user123", "action", 3, 60000, attempts);
      expect(attempts.get("user123:action")?.count).toBe(1);

      // Second attempt
      InputValidator.validateRateLimit("user123", "action", 3, 60000, attempts);
      expect(attempts.get("user123:action")?.count).toBe(2);

      // Third attempt
      InputValidator.validateRateLimit("user123", "action", 3, 60000, attempts);
      expect(attempts.get("user123:action")?.count).toBe(3);
    });

    it("should throw error when rate limit exceeded", () => {
      // Fill up the rate limit
      for (let i = 0; i < 3; i++) {
        InputValidator.validateRateLimit(
          "user123",
          "action",
          3,
          60000,
          attempts
        );
      }

      // This should throw
      expect(() =>
        InputValidator.validateRateLimit(
          "user123",
          "action",
          3,
          60000,
          attempts
        )
      ).toThrow(ApplicationError);
    });

    it("should reset after time window", () => {
      // Set up a rate limit that has already exceeded
      attempts.set("user123:action", {
        count: 5,
        resetTime: Date.now() - 1000, // 1 second ago
      });

      // Should not throw because time window has passed
      expect(() =>
        InputValidator.validateRateLimit(
          "user123",
          "action",
          3,
          60000,
          attempts
        )
      ).not.toThrow();

      // Should have reset count
      expect(attempts.get("user123:action")?.count).toBe(1);
    });

    it("should handle different users separately", () => {
      // User 1 exceeds limit
      for (let i = 0; i < 3; i++) {
        InputValidator.validateRateLimit("user1", "action", 3, 60000, attempts);
      }
      expect(() =>
        InputValidator.validateRateLimit("user1", "action", 3, 60000, attempts)
      ).toThrow();

      // User 2 should still be allowed
      expect(() =>
        InputValidator.validateRateLimit("user2", "action", 3, 60000, attempts)
      ).not.toThrow();
    });

    it("should handle different actions separately", () => {
      // Action 1 exceeds limit
      for (let i = 0; i < 3; i++) {
        InputValidator.validateRateLimit(
          "user1",
          "action1",
          3,
          60000,
          attempts
        );
      }
      expect(() =>
        InputValidator.validateRateLimit("user1", "action1", 3, 60000, attempts)
      ).toThrow();

      // Action 2 should still be allowed for same user
      expect(() =>
        InputValidator.validateRateLimit("user1", "action2", 3, 60000, attempts)
      ).not.toThrow();
    });

    it("should throw ApplicationError with rate limit error type", () => {
      // Fill up the rate limit
      for (let i = 0; i < 3; i++) {
        InputValidator.validateRateLimit(
          "user123",
          "action",
          3,
          5000,
          attempts
        );
      }

      try {
        InputValidator.validateRateLimit(
          "user123",
          "action",
          3,
          5000,
          attempts
        );
      } catch (error) {
        expect(error).toBeInstanceOf(ApplicationError);
        expect((error as ApplicationError).type).toBe(
          ErrorType.RATE_LIMIT_ERROR
        );
        expect((error as ApplicationError).statusCode).toBe(429);
        expect((error as ApplicationError).message).toContain(
          "Rate limit exceeded"
        );
      }
    });
  });
});

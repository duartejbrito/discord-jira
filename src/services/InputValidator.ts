import { ApplicationError, ErrorType } from "./ErrorHandler";

export class ValidationError extends ApplicationError {
  constructor(message: string, field?: string) {
    super(
      field ? `${field}: ${message}` : message,
      ErrorType.VALIDATION_ERROR,
      true
    );
    this.name = "ValidationError";
  }
}

export class InputValidator {
  /**
   * Validate that a string is not empty and within length limits
   */
  static validateString(
    value: unknown,
    fieldName: string,
    options: {
      required?: boolean;
      minLength?: number;
      maxLength?: number;
      pattern?: RegExp;
    } = {}
  ): string {
    const {
      required = false,
      minLength = 0,
      maxLength = Infinity,
      pattern,
    } = options;

    if (value === null || value === undefined) {
      if (required) {
        throw new ValidationError(`${fieldName} is required`);
      }
      return "";
    }

    if (typeof value !== "string") {
      throw new ValidationError(`${fieldName} must be a string`);
    }

    const trimmedValue = value.trim();

    if (required && trimmedValue.length === 0) {
      throw new ValidationError(`${fieldName} cannot be empty`);
    }

    if (trimmedValue.length < minLength) {
      throw new ValidationError(
        `${fieldName} must be at least ${minLength} characters long`
      );
    }

    if (trimmedValue.length > maxLength) {
      throw new ValidationError(
        `${fieldName} must be no more than ${maxLength} characters long`
      );
    }

    if (pattern && !pattern.test(trimmedValue)) {
      throw new ValidationError(`${fieldName} format is invalid`);
    }

    return trimmedValue;
  }

  /**
   * Validate a number within specified bounds
   */
  static validateNumber(
    value: unknown,
    fieldName: string,
    options: {
      required?: boolean;
      min?: number;
      max?: number;
      integer?: boolean;
    } = {}
  ): number {
    const {
      required = false,
      min = -Infinity,
      max = Infinity,
      integer = false,
    } = options;

    if (value === null || value === undefined) {
      if (required) {
        throw new ValidationError(`${fieldName} is required`);
      }
      return 0;
    }

    const numValue = Number(value);

    if (isNaN(numValue)) {
      throw new ValidationError(`${fieldName} must be a valid number`);
    }

    if (integer && !Number.isInteger(numValue)) {
      throw new ValidationError(`${fieldName} must be a whole number`);
    }

    if (numValue < min) {
      throw new ValidationError(`${fieldName} must be at least ${min}`);
    }

    if (numValue > max) {
      throw new ValidationError(`${fieldName} must be no more than ${max}`);
    }

    return numValue;
  }

  /**
   * Validate Jira host URL
   */
  static validateJiraHost(host: string): string {
    const validatedHost = this.validateString(host, "Jira host", {
      required: true,
      minLength: 5,
      maxLength: 200,
    });

    // Remove protocol if provided
    const cleanHost = validatedHost.replace(/^https?:\/\//, "");

    // Basic domain validation
    const domainPattern =
      /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    if (!domainPattern.test(cleanHost)) {
      throw new ValidationError("Jira host must be a valid domain name");
    }

    // Check for common Jira hosting patterns
    if (
      !cleanHost.includes(".atlassian.net") &&
      !cleanHost.includes(".") &&
      cleanHost.length < 8
    ) {
      throw new ValidationError(
        "Jira host appears to be invalid. Please provide the full domain (e.g., yourcompany.atlassian.net)"
      );
    }

    return cleanHost;
  }

  /**
   * Validate email address (for Jira username)
   */
  static validateEmail(email: string): string {
    const validatedEmail = this.validateString(email, "Email", {
      required: true,
      minLength: 5,
      maxLength: 254,
    });

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(validatedEmail)) {
      throw new ValidationError("Email format is invalid");
    }

    return validatedEmail.toLowerCase();
  }

  /**
   * Validate API token
   */
  static validateApiToken(token: string): string {
    const validatedToken = this.validateString(token, "API token", {
      required: true,
      minLength: 10,
      maxLength: 500,
    });

    // Basic token format validation - should not contain obvious invalid characters
    if (
      validatedToken.includes(" ") ||
      validatedToken.includes("\n") ||
      validatedToken.includes("\t")
    ) {
      throw new ValidationError("API token contains invalid characters");
    }

    return validatedToken;
  }

  /**
   * Validate JQL query
   */
  static validateJQL(jql?: string): string | undefined {
    if (!jql) {
      return undefined;
    }

    const validatedJql = this.validateString(jql, "JQL query", {
      required: false,
      minLength: 5,
      maxLength: 1000,
    });

    // Basic JQL validation - should contain some common JQL keywords
    const jqlKeywords =
      /\b(assignee|project|status|created|updated|key|summary|AND|OR|NOT|WAS|ON|IN|IS|=|!=|>|<|>=|<=)\b/i;

    if (validatedJql && !jqlKeywords.test(validatedJql)) {
      throw new ValidationError(
        "JQL query does not appear to contain valid JQL syntax"
      );
    }

    return validatedJql || undefined;
  }

  /**
   * Validate daily hours
   */
  static validateDailyHours(hours: unknown): number {
    return (
      this.validateNumber(hours, "Daily hours", {
        required: false,
        min: 1,
        max: 24,
        integer: true,
      }) || 8
    ); // Default value
  }

  /**
   * Sanitize user input to prevent injection attacks
   */
  static sanitizeInput(input: string): string {
    // Remove control characters using a safer regex pattern
    return input
      .replace(/[<>]/g, "") // Remove potential HTML/XML brackets
      .replace(/['"]/g, "") // Remove quotes that could break SQL
      .replace(/\p{Cc}/gu, "") // Remove control characters using Unicode property
      .trim();
  }

  /**
   * Validate Discord snowflake ID
   */
  static validateDiscordId(id: string, fieldName: string): string {
    const validatedId = this.validateString(id, fieldName, {
      required: true,
      minLength: 17,
      maxLength: 19,
    });

    if (!/^\d+$/.test(validatedId)) {
      throw new ValidationError(`${fieldName} must contain only digits`);
    }

    return validatedId;
  }

  /**
   * Rate limiting validation - check if user has exceeded rate limits
   */
  static validateRateLimit(
    userId: string,
    action: string,
    maxAttempts: number,
    windowMs: number,
    attempts: Map<string, { count: number; resetTime: number }>
  ): void {
    const key = `${userId}:${action}`;
    const now = Date.now();
    const userAttempts = attempts.get(key);

    if (!userAttempts || now > userAttempts.resetTime) {
      // Reset or initialize
      attempts.set(key, { count: 1, resetTime: now + windowMs });
      return;
    }

    if (userAttempts.count >= maxAttempts) {
      const remainingTime = Math.ceil((userAttempts.resetTime - now) / 1000);
      throw new ApplicationError(
        `Rate limit exceeded. Please wait ${remainingTime} seconds before trying again.`,
        ErrorType.RATE_LIMIT_ERROR,
        true,
        429
      );
    }

    userAttempts.count++;
  }
}

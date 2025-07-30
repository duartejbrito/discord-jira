import { CommandInteraction, MessageFlags } from "discord.js";
import { Response as NodeFetchResponse } from "node-fetch";
import {
  ApplicationError,
  ErrorHandler,
  ErrorType,
} from "../../src/services/ErrorHandler";
import { ILoggerService } from "../../src/services/LoggerService";

describe("ErrorHandler", () => {
  let mockLogger: ILoggerService;
  let mockInteraction: jest.Mocked<CommandInteraction>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      initialize: jest.fn(),
      logInfo: jest.fn(),
      logWarn: jest.fn(),
      logDebug: jest.fn(),
      logError: jest.fn(),
    };

    mockInteraction = {
      commandName: "test-command",
      guildId: "guild123",
      user: { id: "user123" },
      replied: false,
      deferred: false,
      reply: jest.fn().mockResolvedValue(undefined),
      followUp: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CommandInteraction>;

    jest.clearAllMocks();
  });

  describe("ApplicationError", () => {
    it("should create ApplicationError with default values", () => {
      const error = new ApplicationError("Test message");

      expect(error.message).toBe("Test message");
      expect(error.name).toBe("ApplicationError");
      expect(error.type).toBe(ErrorType.UNKNOWN_ERROR);
      expect(error.isOperational).toBe(true);
      expect(error.statusCode).toBeUndefined();
      expect(error.details).toBeUndefined();
    });

    it("should create ApplicationError with custom values", () => {
      const details = { key: "value" };
      const error = new ApplicationError(
        "Custom message",
        ErrorType.VALIDATION_ERROR,
        false,
        400,
        details
      );

      expect(error.message).toBe("Custom message");
      expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(error.isOperational).toBe(false);
      expect(error.statusCode).toBe(400);
      expect(error.details).toBe(details);
    });

    it("should maintain proper stack trace", () => {
      const error = new ApplicationError("Test message");
      expect(error.stack).toBeDefined();
    });
  });

  describe("handleCommandError", () => {
    it("should handle command error with logger and reply", async () => {
      const error = new ApplicationError(
        "Test error",
        ErrorType.VALIDATION_ERROR
      );

      await ErrorHandler.handleCommandError(mockInteraction, error, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Command execution failed",
        expect.objectContaining({
          errorId: expect.stringMatching(/^ERR-\d+-[A-Z0-9]+$/),
          commandName: "test-command",
          guildId: "guild123",
          userId: "user123",
          errorType: ErrorType.VALIDATION_ERROR,
          errorMessage: "Test error",
          stack: expect.any(String),
          details: undefined,
        })
      );

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: "❌ **Invalid Input**: Test error",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should handle command error without logger", async () => {
      const error = new Error("Generic error");

      await ErrorHandler.handleCommandError(mockInteraction, error);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining(
          "❌ **Unexpected Error**: Something went wrong"
        ),
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should handle followUp when interaction is already replied", async () => {
      mockInteraction.replied = true;
      const error = new ApplicationError(
        "Test error",
        ErrorType.JIRA_API_ERROR
      );

      await ErrorHandler.handleCommandError(mockInteraction, error, mockLogger);

      expect(mockInteraction.followUp).toHaveBeenCalledWith({
        content:
          "❌ **Jira Error**: Test error\n\nPlease check your Jira configuration with `/info` and verify your credentials.",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should handle editReply when interaction is deferred", async () => {
      mockInteraction.deferred = true;
      const error = new ApplicationError(
        "Test error",
        ErrorType.DATABASE_ERROR
      );

      await ErrorHandler.handleCommandError(mockInteraction, error, mockLogger);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining(
          "❌ **Database Error**: Unable to save your data"
        ),
      });
    });

    it("should handle reply failure gracefully", async () => {
      const replyError = new Error("Reply failed");
      mockInteraction.reply.mockRejectedValue(replyError);
      const error = new ApplicationError("Test error");

      await ErrorHandler.handleCommandError(mockInteraction, error, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to send error message to user",
        expect.objectContaining({
          errorId: expect.any(String),
          originalError: "Test error",
          replyError: "Reply failed",
        })
      );
    });

    it("should handle non-Error reply failure", async () => {
      mockInteraction.reply.mockRejectedValue("String error");
      const error = new ApplicationError("Test error");

      await ErrorHandler.handleCommandError(mockInteraction, error, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to send error message to user",
        expect.objectContaining({
          replyError: "String error",
        })
      );
    });
  });

  describe("handleSchedulerError", () => {
    it("should handle scheduler error with logger", () => {
      const error = new ApplicationError(
        "Scheduler failed",
        ErrorType.NETWORK_ERROR
      );
      const context = { jobId: "job123" };

      ErrorHandler.handleSchedulerError(error, mockLogger, context);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Scheduler job failed",
        expect.objectContaining({
          errorId: expect.stringMatching(/^ERR-\d+-[A-Z0-9]+$/),
          errorType: ErrorType.NETWORK_ERROR,
          errorMessage: "Scheduler failed",
          stack: expect.any(String),
          context,
          details: undefined,
        })
      );
    });

    it("should handle scheduler error without logger", () => {
      const error = new Error("Generic scheduler error");

      // Should not throw
      expect(() => {
        ErrorHandler.handleSchedulerError(error);
      }).not.toThrow();
    });

    it("should handle non-operational errors with critical alert", () => {
      const error = new ApplicationError(
        "Critical error",
        ErrorType.DATABASE_ERROR,
        false // non-operational
      );

      ErrorHandler.handleSchedulerError(error, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenNthCalledWith(
        2,
        "Critical scheduler error detected - manual intervention may be required",
        expect.objectContaining({
          errorId: expect.any(String),
          error: "Critical error",
        })
      );
    });

    it("should handle generic Error instance", () => {
      const error = new Error("Generic error");

      ErrorHandler.handleSchedulerError(error, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Scheduler job failed",
        expect.objectContaining({
          errorType: "UNKNOWN_ERROR",
          errorMessage: "Generic error",
          details: undefined,
        })
      );
    });
  });

  describe("error message generation through public methods", () => {
    it("should return validation error message through handleCommandError", async () => {
      const error = new ApplicationError(
        "Invalid input",
        ErrorType.VALIDATION_ERROR
      );

      await ErrorHandler.handleCommandError(mockInteraction, error, mockLogger);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: "❌ **Invalid Input**: Invalid input",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should return Jira API error message through handleCommandError", async () => {
      const error = new ApplicationError(
        "API failed",
        ErrorType.JIRA_API_ERROR
      );

      await ErrorHandler.handleCommandError(mockInteraction, error, mockLogger);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content:
          "❌ **Jira Error**: API failed\n\nPlease check your Jira configuration with `/info` and verify your credentials.",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should return database error message through handleCommandError", async () => {
      const error = new ApplicationError("DB failed", ErrorType.DATABASE_ERROR);

      await ErrorHandler.handleCommandError(mockInteraction, error, mockLogger);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining(
          "❌ **Database Error**: Unable to save your data. Please try again in a few minutes."
        ),
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should return authentication error message through handleCommandError", async () => {
      const error = new ApplicationError(
        "Auth failed",
        ErrorType.AUTHENTICATION_ERROR
      );

      await ErrorHandler.handleCommandError(mockInteraction, error, mockLogger);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content:
          "❌ **Authentication Failed**: Your Jira credentials appear to be invalid. Please run `/setup` to reconfigure your connection.",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should return authorization error message through handleCommandError", async () => {
      const error = new ApplicationError(
        "Access denied",
        ErrorType.AUTHORIZATION_ERROR
      );

      await ErrorHandler.handleCommandError(mockInteraction, error, mockLogger);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content:
          "❌ **Access Denied**: You don't have permission to perform this action in Jira.",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should return rate limit error message through handleCommandError", async () => {
      const error = new ApplicationError(
        "Rate limited",
        ErrorType.RATE_LIMIT_ERROR
      );

      await ErrorHandler.handleCommandError(mockInteraction, error, mockLogger);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content:
          "❌ **Rate Limited**: Too many requests to Jira. Please wait a few minutes before trying again.",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should return network error message through handleCommandError", async () => {
      const error = new ApplicationError(
        "Network failed",
        ErrorType.NETWORK_ERROR
      );

      await ErrorHandler.handleCommandError(mockInteraction, error, mockLogger);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining(
          "❌ **Network Error**: Unable to connect to Jira. Please check if your Jira instance is accessible."
        ),
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should return default error message for unknown ApplicationError type through handleCommandError", async () => {
      const error = new ApplicationError("Unknown error");

      await ErrorHandler.handleCommandError(mockInteraction, error, mockLogger);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining(
          "❌ **Unexpected Error**: Something went wrong. Please try again."
        ),
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should handle generic Error with unauthorized message through handleCommandError", async () => {
      const error = new Error("Unauthorized access");

      await ErrorHandler.handleCommandError(mockInteraction, error, mockLogger);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content:
          "❌ **Authentication Failed**: Your Jira credentials appear to be invalid. Please run `/setup` to reconfigure your connection.",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should handle generic Error with not found message through handleCommandError", async () => {
      const error = new Error("Resource not found");

      await ErrorHandler.handleCommandError(mockInteraction, error, mockLogger);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content:
          "❌ **Not Found**: The requested resource was not found in Jira. Please check your configuration.",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should handle generic Error with default message through handleCommandError", async () => {
      const error = new Error("Some random error");

      await ErrorHandler.handleCommandError(mockInteraction, error, mockLogger);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining(
          "❌ **Unexpected Error**: Something went wrong. Please try again."
        ),
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should handle error without message through handleCommandError", async () => {
      const error = new Error();

      await ErrorHandler.handleCommandError(mockInteraction, error, mockLogger);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining(
          "❌ **Unexpected Error**: Something went wrong. Please try again."
        ),
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should generate unique error IDs in different error scenarios", async () => {
      const error1 = new ApplicationError("Error 1");
      const error2 = new ApplicationError("Error 2");

      await ErrorHandler.handleCommandError(
        mockInteraction,
        error1,
        mockLogger
      );
      mockInteraction.reply.mockClear();
      await ErrorHandler.handleCommandError(
        mockInteraction,
        error2,
        mockLogger
      );

      const call1 = (mockLogger.error as jest.Mock).mock.calls[0][1];
      const call2 = (mockLogger.error as jest.Mock).mock.calls[1][1];

      expect(call1.errorId).toMatch(/^ERR-\d+-[A-Z0-9]+$/);
      expect(call2.errorId).toMatch(/^ERR-\d+-[A-Z0-9]+$/);
      expect(call1.errorId).not.toBe(call2.errorId);
    });
  });

  describe("wrapJiraError", () => {
    it("should wrap 401 error", () => {
      const response = {
        status: 401,
        statusText: "Unauthorized",
      } as NodeFetchResponse;

      const error = ErrorHandler.wrapJiraError(response, "test context");

      expect(error).toBeInstanceOf(ApplicationError);
      expect(error.type).toBe(ErrorType.AUTHENTICATION_ERROR);
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe("Invalid credentials (test context)");
    });

    it("should wrap 403 error", () => {
      const response = {
        status: 403,
        statusText: "Forbidden",
      } as NodeFetchResponse;

      const error = ErrorHandler.wrapJiraError(response);

      expect(error.type).toBe(ErrorType.AUTHORIZATION_ERROR);
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe("Access denied");
    });

    it("should wrap 404 error", () => {
      const response = {
        status: 404,
        statusText: "Not Found",
      } as NodeFetchResponse;

      const error = ErrorHandler.wrapJiraError(response);

      expect(error.type).toBe(ErrorType.JIRA_API_ERROR);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe("Resource not found");
    });

    it("should wrap 429 error", () => {
      const response = {
        status: 429,
        statusText: "Too Many Requests",
      } as NodeFetchResponse;

      const error = ErrorHandler.wrapJiraError(response);

      expect(error.type).toBe(ErrorType.RATE_LIMIT_ERROR);
      expect(error.statusCode).toBe(429);
      expect(error.message).toBe("Rate limit exceeded");
    });

    it("should wrap 500 server error", () => {
      const response = {
        status: 500,
        statusText: "Internal Server Error",
      } as NodeFetchResponse;

      const error = ErrorHandler.wrapJiraError(response);

      expect(error.type).toBe(ErrorType.JIRA_API_ERROR);
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe("Jira server error");
    });

    it("should wrap 502 server error", () => {
      const response = {
        status: 502,
        statusText: "Bad Gateway",
      } as NodeFetchResponse;

      const error = ErrorHandler.wrapJiraError(response);

      expect(error.type).toBe(ErrorType.JIRA_API_ERROR);
      expect(error.statusCode).toBe(502);
    });

    it("should wrap 503 server error", () => {
      const response = {
        status: 503,
        statusText: "Service Unavailable",
      } as NodeFetchResponse;

      const error = ErrorHandler.wrapJiraError(response);

      expect(error.type).toBe(ErrorType.JIRA_API_ERROR);
      expect(error.statusCode).toBe(503);
    });

    it("should wrap 504 server error", () => {
      const response = {
        status: 504,
        statusText: "Gateway Timeout",
      } as NodeFetchResponse;

      const error = ErrorHandler.wrapJiraError(response);

      expect(error.type).toBe(ErrorType.JIRA_API_ERROR);
      expect(error.statusCode).toBe(504);
    });

    it("should wrap unknown status code", () => {
      const response = {
        status: 418,
        statusText: "I'm a teapot",
      } as NodeFetchResponse;

      const error = ErrorHandler.wrapJiraError(response);

      expect(error.type).toBe(ErrorType.JIRA_API_ERROR);
      expect(error.statusCode).toBe(418);
      expect(error.message).toBe("Jira API error: I'm a teapot");
    });
  });

  describe("wrapDatabaseError", () => {
    it("should wrap database error with operation", () => {
      const originalError = new Error("Connection failed");
      const error = ErrorHandler.wrapDatabaseError(
        originalError,
        "user lookup"
      );

      expect(error).toBeInstanceOf(ApplicationError);
      expect(error.type).toBe(ErrorType.DATABASE_ERROR);
      expect(error.message).toBe(
        "Database operation failed during user lookup: Connection failed"
      );
      expect(error.details).toEqual({ originalError: "Connection failed" });
    });

    it("should wrap database error without operation", () => {
      const originalError = new Error("Connection failed");
      const error = ErrorHandler.wrapDatabaseError(originalError);

      expect(error.message).toBe(
        "Database operation failed: Connection failed"
      );
    });
  });

  describe("shouldRetry", () => {
    it("should retry retryable ApplicationError types", () => {
      const networkError = new ApplicationError(
        "Network error",
        ErrorType.NETWORK_ERROR
      );
      const rateLimitError = new ApplicationError(
        "Rate limited",
        ErrorType.RATE_LIMIT_ERROR
      );
      const jiraError = new ApplicationError(
        "Jira error",
        ErrorType.JIRA_API_ERROR
      );

      expect(ErrorHandler.shouldRetry(networkError)).toBe(true);
      expect(ErrorHandler.shouldRetry(rateLimitError)).toBe(true);
      expect(ErrorHandler.shouldRetry(jiraError)).toBe(true);
    });

    it("should not retry non-retryable ApplicationError types", () => {
      const validationError = new ApplicationError(
        "Invalid",
        ErrorType.VALIDATION_ERROR
      );
      const authError = new ApplicationError(
        "Auth failed",
        ErrorType.AUTHENTICATION_ERROR
      );
      const dbError = new ApplicationError(
        "DB failed",
        ErrorType.DATABASE_ERROR
      );

      expect(ErrorHandler.shouldRetry(validationError)).toBe(false);
      expect(ErrorHandler.shouldRetry(authError)).toBe(false);
      expect(ErrorHandler.shouldRetry(dbError)).toBe(false);
    });

    it("should not retry 401, 403, 404 status codes", () => {
      const error401 = new ApplicationError(
        "Unauthorized",
        ErrorType.JIRA_API_ERROR,
        true,
        401
      );
      const error403 = new ApplicationError(
        "Forbidden",
        ErrorType.JIRA_API_ERROR,
        true,
        403
      );
      const error404 = new ApplicationError(
        "Not found",
        ErrorType.JIRA_API_ERROR,
        true,
        404
      );

      expect(ErrorHandler.shouldRetry(error401)).toBe(false);
      expect(ErrorHandler.shouldRetry(error403)).toBe(false);
      expect(ErrorHandler.shouldRetry(error404)).toBe(false);
    });

    it("should retry generic Error with retryable messages", () => {
      const timeoutError = new Error("Request timeout");
      const networkError = new Error("Network error occurred");
      const econnresetError = new Error("ECONNRESET");
      const enotfoundError = new Error("ENOTFOUND example.com");

      expect(ErrorHandler.shouldRetry(timeoutError)).toBe(true);
      expect(ErrorHandler.shouldRetry(networkError)).toBe(true);
      expect(ErrorHandler.shouldRetry(econnresetError)).toBe(true);
      expect(ErrorHandler.shouldRetry(enotfoundError)).toBe(true);
    });

    it("should not retry generic Error with non-retryable messages", () => {
      const validationError = new Error("Invalid input provided");
      const genericError = new Error("Something went wrong");

      expect(ErrorHandler.shouldRetry(validationError)).toBe(false);
      expect(ErrorHandler.shouldRetry(genericError)).toBe(false);
    });
  });
});

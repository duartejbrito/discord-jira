import { CommandInteraction, MessageFlags } from "discord.js";
import { Response as NodeFetchResponse } from "node-fetch";
import { ILoggerService } from "./LoggerService";

export enum ErrorType {
  /* eslint-disable no-unused-vars */
  VALIDATION_ERROR = "VALIDATION_ERROR",
  JIRA_API_ERROR = "JIRA_API_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",
  RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
  /* eslint-enable no-unused-vars */
}

export class ApplicationError extends Error {
  public readonly type: ErrorType;
  public readonly isOperational: boolean;
  public readonly statusCode?: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN_ERROR,
    isOperational = true,
    statusCode?: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApplicationError";
    this.type = type;
    this.isOperational = isOperational;
    this.statusCode = statusCode;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, ApplicationError);
  }
}

export class ErrorHandler {
  /**
   * Handle command execution errors with appropriate user feedback
   */
  static async handleCommandError(
    interaction: CommandInteraction,
    error: Error | ApplicationError,
    logger?: ILoggerService
  ): Promise<void> {
    const errorId = this.generateErrorId();

    // Log the error with context if logger is available
    if (logger) {
      logger.error("Command execution failed", {
        errorId,
        commandName: interaction.commandName,
        guildId: interaction.guildId,
        userId: interaction.user.id,
        errorType:
          error instanceof ApplicationError ? error.type : "UNKNOWN_ERROR",
        errorMessage: error.message,
        stack: error.stack,
        details: error instanceof ApplicationError ? error.details : undefined,
      });
    }

    const userMessage = this.getUserFriendlyMessage(error, errorId);

    try {
      if (interaction.replied) {
        await interaction.followUp({
          content: userMessage,
          flags: MessageFlags.Ephemeral,
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          content: userMessage,
        });
      } else {
        await interaction.reply({
          content: userMessage,
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (replyError) {
      if (logger) {
        logger.error("Failed to send error message to user", {
          errorId,
          originalError: error.message,
          replyError:
            replyError instanceof Error
              ? replyError.message
              : String(replyError),
        });
      }
    }
  }

  /**
   * Handle scheduler job errors
   */
  static handleSchedulerError(
    error: Error | ApplicationError,
    logger?: ILoggerService,
    context: Record<string, unknown> = {}
  ): void {
    const errorId = this.generateErrorId();

    if (logger) {
      logger.error("Scheduler job failed", {
        errorId,
        errorType:
          error instanceof ApplicationError ? error.type : "UNKNOWN_ERROR",
        errorMessage: error.message,
        stack: error.stack,
        context,
        details: error instanceof ApplicationError ? error.details : undefined,
      });

      // For critical scheduler errors, we might want to send alerts
      if (error instanceof ApplicationError && !error.isOperational) {
        // This could send to a monitoring service or admin channel
        logger.error(
          "Critical scheduler error detected - manual intervention may be required",
          {
            errorId,
            error: error.message,
          }
        );
      }
    }
  }

  /**
   * Convert errors to user-friendly messages
   */
  private static getUserFriendlyMessage(
    error: Error | ApplicationError,
    errorId: string
  ): string {
    if (error instanceof ApplicationError) {
      switch (error.type) {
        case ErrorType.VALIDATION_ERROR:
          return `❌ **Invalid Input**: ${error.message}`;
        case ErrorType.JIRA_API_ERROR:
          return `❌ **Jira Error**: ${error.message}\n\nPlease check your Jira configuration with \`/info\` and verify your credentials.`;
        case ErrorType.DATABASE_ERROR:
          return `❌ **Database Error**: Unable to save your data. Please try again in a few minutes.\n\n*Error ID: ${errorId}*`;
        case ErrorType.AUTHENTICATION_ERROR:
          return "❌ **Authentication Failed**: Your Jira credentials appear to be invalid. Please run `/setup` to reconfigure your connection.";
        case ErrorType.AUTHORIZATION_ERROR:
          return "❌ **Access Denied**: You don't have permission to perform this action in Jira.";
        case ErrorType.RATE_LIMIT_ERROR:
          return "❌ **Rate Limited**: Too many requests to Jira. Please wait a few minutes before trying again.";
        case ErrorType.NETWORK_ERROR:
          return `❌ **Network Error**: Unable to connect to Jira. Please check if your Jira instance is accessible.\n\n*Error ID: ${errorId}*`;
        default:
          return `❌ **Unexpected Error**: Something went wrong. Please try again.\n\n*Error ID: ${errorId}*`;
      }
    }

    // Generic error handling for non-ApplicationError instances
    const errorMessage = error.message || String(error);

    if (errorMessage.toLowerCase().includes("unauthorized")) {
      return "❌ **Authentication Failed**: Your Jira credentials appear to be invalid. Please run `/setup` to reconfigure your connection.";
    }

    if (errorMessage.toLowerCase().includes("not found")) {
      return "❌ **Not Found**: The requested resource was not found in Jira. Please check your configuration.";
    }

    return `❌ **Unexpected Error**: Something went wrong. Please try again.\n\n*Error ID: ${errorId}*`;
  }

  /**
   * Generate a unique error ID for tracking
   */
  private static generateErrorId(): string {
    return `ERR-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)
      .toUpperCase()}`;
  }

  /**
   * Wrap Jira API errors with appropriate error types
   */
  static wrapJiraError(
    response: NodeFetchResponse,
    context?: string
  ): ApplicationError {
    const contextMsg = context ? ` (${context})` : "";

    switch (response.status) {
      case 401:
        return new ApplicationError(
          `Invalid credentials${contextMsg}`,
          ErrorType.AUTHENTICATION_ERROR,
          true,
          401
        );
      case 403:
        return new ApplicationError(
          `Access denied${contextMsg}`,
          ErrorType.AUTHORIZATION_ERROR,
          true,
          403
        );
      case 404:
        return new ApplicationError(
          `Resource not found${contextMsg}`,
          ErrorType.JIRA_API_ERROR,
          true,
          404
        );
      case 429:
        return new ApplicationError(
          `Rate limit exceeded${contextMsg}`,
          ErrorType.RATE_LIMIT_ERROR,
          true,
          429
        );
      case 500:
      case 502:
      case 503:
      case 504:
        return new ApplicationError(
          `Jira server error${contextMsg}`,
          ErrorType.JIRA_API_ERROR,
          true,
          response.status
        );
      default:
        return new ApplicationError(
          `Jira API error: ${response.statusText}${contextMsg}`,
          ErrorType.JIRA_API_ERROR,
          true,
          response.status
        );
    }
  }

  /**
   * Wrap database errors
   */
  static wrapDatabaseError(error: Error, operation?: string): ApplicationError {
    const operationMsg = operation ? ` during ${operation}` : "";

    return new ApplicationError(
      `Database operation failed${operationMsg}: ${error.message}`,
      ErrorType.DATABASE_ERROR,
      true,
      undefined,
      { originalError: error.message }
    );
  }

  /**
   * Validate if error should be retried
   */
  static shouldRetry(error: Error | ApplicationError): boolean {
    if (error instanceof ApplicationError) {
      return (
        [
          ErrorType.NETWORK_ERROR,
          ErrorType.RATE_LIMIT_ERROR,
          ErrorType.JIRA_API_ERROR,
        ].includes(error.type) &&
        error.statusCode !== 401 &&
        error.statusCode !== 403 &&
        error.statusCode !== 404
      );
    }

    // Generic retry logic for non-ApplicationError instances
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("econnreset") ||
      message.includes("enotfound")
    );
  }
}

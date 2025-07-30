import { Response as NodeFetchResponse } from "node-fetch";
import { ApplicationError, ErrorHandler, ErrorType } from "./ErrorHandler";
import { ILoggerService } from "./LoggerService";

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  exponentialBase: number;
  jitter: boolean;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  exponentialBase: 2,
  jitter: true,
};

export class RetryUtil {
  /**
   * Execute a function with exponential backoff retry logic
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {},
    logger?: ILoggerService,
    operationName?: string
  ): Promise<T> {
    const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
    let lastError: Error;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry if it's not a retryable error
        if (!ErrorHandler.shouldRetry(lastError)) {
          if (logger && operationName) {
            logger.warn(
              `Operation ${operationName} failed with non-retryable error`,
              {
                attempt,
                error: lastError.message,
              }
            );
          }
          throw lastError;
        }

        // Don't wait after the last attempt
        if (attempt === config.maxAttempts) {
          if (logger && operationName) {
            logger.error(
              `Operation ${operationName} failed after ${config.maxAttempts} attempts`,
              {
                finalError: lastError.message,
              }
            );
          }
          break;
        }

        const delay = this.calculateDelay(attempt, config);

        if (logger && operationName) {
          logger.warn(
            `Operation ${operationName} failed, retrying in ${delay}ms`,
            {
              attempt,
              maxAttempts: config.maxAttempts,
              error: lastError.message,
            }
          );
        }

        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Retry specifically for HTTP requests with appropriate error wrapping
   */
  static async withHttpRetry(
    operation: () => Promise<NodeFetchResponse>,
    options: Partial<RetryOptions> = {},
    logger?: ILoggerService,
    operationName?: string
  ): Promise<NodeFetchResponse> {
    return this.withRetry(
      async () => {
        const response = await operation();

        // Consider 5xx errors as retryable, but not 4xx errors
        if (!response.ok && response.status >= 500) {
          throw ErrorHandler.wrapJiraError(response, operationName);
        }

        return response;
      },
      options,
      logger,
      operationName
    );
  }

  /**
   * Calculate delay with exponential backoff and optional jitter
   */
  private static calculateDelay(attempt: number, config: RetryOptions): number {
    const exponentialDelay =
      config.baseDelayMs * Math.pow(config.exponentialBase, attempt - 1);
    let delay = Math.min(exponentialDelay, config.maxDelayMs);

    if (config.jitter) {
      // Add random jitter of ±25%
      const jitterRange = delay * 0.25;
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      delay = Math.max(0, delay + jitter);
    }

    return Math.floor(delay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a circuit breaker for repeated failures
   */
  static createCircuitBreaker(failureThreshold = 5, recoveryTimeMs = 60000) {
    let failures = 0;
    let lastFailureTime = 0;
    let isOpen = false;

    return {
      async execute<T>(operation: () => Promise<T>): Promise<T> {
        // Check if circuit breaker should reset
        if (isOpen && Date.now() - lastFailureTime > recoveryTimeMs) {
          isOpen = false;
          failures = 0;
        }

        // Reject if circuit breaker is open
        if (isOpen) {
          throw new ApplicationError(
            "Circuit breaker is open - service temporarily unavailable",
            ErrorType.NETWORK_ERROR,
            true,
            503
          );
        }

        try {
          const result = await operation();
          // Reset failure count on success
          failures = 0;
          return result;
        } catch (error) {
          failures++;
          lastFailureTime = Date.now();

          // Open circuit breaker if threshold reached
          if (failures >= failureThreshold) {
            isOpen = true;
          }

          throw error;
        }
      },

      get state() {
        return {
          isOpen,
          failures,
          lastFailureTime,
        };
      },
    };
  }
}

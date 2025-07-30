import { ApplicationError, ErrorType } from "./ErrorHandler";

/* eslint-disable no-unused-vars */
export interface IRateLimitService {
  setRule(action: string, rule: RateLimitRule): void;
  resetUserRateLimit(userId: string, action?: string): void;
  checkRateLimit(userId: string, action: string): void;
  getRateLimitStatus(
    userId: string,
    action: string
  ): {
    remaining: number;
    resetTime: number;
    blocked: boolean;
    blockedUntil?: number;
  };
  getStatistics(): {
    totalTrackedUsers: number;
    totalRules: number;
    topActions: Array<{ action: string; attempts: number }>;
  };
}
/* eslint-enable no-unused-vars */

export interface RateLimitRule {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs?: number;
}

export interface RateLimitAttempt {
  count: number;
  resetTime: number;
  blockedUntil?: number;
}

export class RateLimitService implements IRateLimitService {
  private attempts = new Map<string, RateLimitAttempt>();
  private rules = new Map<string, RateLimitRule>();

  constructor() {
    // Default rate limit rules
    this.setRule("setup", { maxAttempts: 5, windowMs: 300000 }); // 5 attempts per 5 minutes
    this.setRule("time", { maxAttempts: 10, windowMs: 60000 }); // 10 attempts per minute
    this.setRule("hours", { maxAttempts: 5, windowMs: 60000 }); // 5 attempts per minute
    this.setRule("pause", { maxAttempts: 3, windowMs: 60000 }); // 3 attempts per minute
    this.setRule("info", { maxAttempts: 20, windowMs: 60000 }); // 20 attempts per minute
    this.setRule("health", { maxAttempts: 3, windowMs: 300000 }); // 3 attempts per 5 minutes

    // Clean up expired entries periodically
    setInterval(() => this.cleanup(), 300000); // Every 5 minutes
  }

  /**
   * Set a rate limit rule for a specific action
   */
  setRule(action: string, rule: RateLimitRule): void {
    this.rules.set(action, rule);
  }

  /**
   * Check if a user action is within rate limits
   */
  checkRateLimit(userId: string, action: string): void {
    const rule = this.rules.get(action);
    if (!rule) {
      return; // No rule defined, allow
    }

    const key = `${userId}:${action}`;
    const now = Date.now();
    const userAttempts = this.attempts.get(key);

    // Check if user is currently blocked
    if (userAttempts?.blockedUntil && now < userAttempts.blockedUntil) {
      const remainingTime = Math.ceil((userAttempts.blockedUntil - now) / 1000);
      throw new ApplicationError(
        `You are temporarily blocked. Please wait ${remainingTime} seconds before trying again.`,
        ErrorType.RATE_LIMIT_ERROR,
        true,
        429
      );
    }

    if (!userAttempts || now >= userAttempts.resetTime) {
      // Reset or initialize
      this.attempts.set(key, {
        count: 1,
        resetTime: now + rule.windowMs,
      });
      return;
    }

    if (userAttempts.count >= rule.maxAttempts) {
      // Apply block if specified
      if (rule.blockDurationMs) {
        userAttempts.blockedUntil = now + rule.blockDurationMs;
        const blockTime = Math.ceil(rule.blockDurationMs / 1000);
        throw new ApplicationError(
          `Rate limit exceeded. You are blocked for ${blockTime} seconds.`,
          ErrorType.RATE_LIMIT_ERROR,
          true,
          429
        );
      }

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

  /**
   * Get rate limit status for a user and action
   */
  getRateLimitStatus(
    userId: string,
    action: string
  ): {
    remaining: number;
    resetTime: number;
    blocked: boolean;
    blockedUntil?: number;
  } {
    const rule = this.rules.get(action);
    if (!rule) {
      return { remaining: Infinity, resetTime: 0, blocked: false };
    }

    const key = `${userId}:${action}`;
    const userAttempts = this.attempts.get(key);
    const now = Date.now();

    if (!userAttempts || now >= userAttempts.resetTime) {
      return {
        remaining: rule.maxAttempts,
        resetTime: now + rule.windowMs,
        blocked: false,
      };
    }

    const isBlocked =
      userAttempts.blockedUntil && now < userAttempts.blockedUntil;

    return {
      remaining: Math.max(0, rule.maxAttempts - userAttempts.count),
      resetTime: userAttempts.resetTime,
      blocked: isBlocked || false,
      blockedUntil: userAttempts.blockedUntil,
    };
  }

  /**
   * Reset rate limit for a specific user and action
   */
  resetUserRateLimit(userId: string, action?: string): void {
    if (action) {
      const key = `${userId}:${action}`;
      this.attempts.delete(key);
    } else {
      // Reset all actions for this user
      const userKeys = Array.from(this.attempts.keys()).filter((key) =>
        key.startsWith(`${userId}:`)
      );
      userKeys.forEach((key) => this.attempts.delete(key));
    }
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, attempt] of this.attempts.entries()) {
      // Remove if both reset time and block time have passed
      const resetExpired = now >= attempt.resetTime;
      const blockExpired = !attempt.blockedUntil || now >= attempt.blockedUntil;

      if (resetExpired && blockExpired) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach((key) => this.attempts.delete(key));
  }

  /**
   * Get statistics about current rate limits
   */
  getStatistics(): {
    totalTrackedUsers: number;
    totalRules: number;
    topActions: Array<{ action: string; attempts: number }>;
  } {
    const actionCounts = new Map<string, number>();
    const userIds = new Set<string>();

    for (const [key, attempt] of this.attempts.entries()) {
      const [userId, action] = key.split(":");
      userIds.add(userId);

      const currentCount = actionCounts.get(action) || 0;
      actionCounts.set(action, currentCount + attempt.count);
    }

    const topActions = Array.from(actionCounts.entries())
      .map(([action, attempts]) => ({ action, attempts }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 10);

    return {
      totalTrackedUsers: userIds.size,
      totalRules: this.rules.size,
      topActions,
    };
  }
}

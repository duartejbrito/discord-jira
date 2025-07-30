import { ApplicationError, ErrorType } from "../../src/services/ErrorHandler";
import {
  IRateLimitService,
  RateLimitService,
} from "../../src/services/RateLimitService";

describe("RateLimitService", () => {
  let rateLimitService: IRateLimitService;
  let mockSetInterval: jest.SpyInstance;

  beforeEach(() => {
    mockSetInterval = jest
      .spyOn(global, "setInterval")
      .mockImplementation(() => ({} as NodeJS.Timeout));
    rateLimitService = new RateLimitService();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    mockSetInterval.mockRestore();
  });

  describe("constructor", () => {
    it("should initialize with default rate limit rules", () => {
      const statistics = rateLimitService.getStatistics();
      expect(statistics.totalRules).toBe(6);
    });

    it("should set up periodic cleanup", () => {
      expect(mockSetInterval).toHaveBeenCalledWith(
        expect.any(Function),
        300000
      );
    });
  });

  describe("setRule", () => {
    it("should set a custom rate limit rule", () => {
      rateLimitService.setRule("custom", { maxAttempts: 3, windowMs: 1000 });

      const status = rateLimitService.getRateLimitStatus("user1", "custom");
      expect(status.remaining).toBe(3);
    });

    it("should override existing rules", () => {
      rateLimitService.setRule("setup", { maxAttempts: 10, windowMs: 5000 });

      const status = rateLimitService.getRateLimitStatus("user1", "setup");
      expect(status.remaining).toBe(10);
    });
  });

  describe("checkRateLimit", () => {
    it("should allow first attempt within rate limit", () => {
      expect(() => {
        rateLimitService.checkRateLimit("user1", "time");
      }).not.toThrow();
    });

    it("should track subsequent attempts", () => {
      rateLimitService.checkRateLimit("user1", "time");
      rateLimitService.checkRateLimit("user1", "time");

      const status = rateLimitService.getRateLimitStatus("user1", "time");
      expect(status.remaining).toBe(8); // 10 max - 2 used
    });

    it("should allow action when no rule is defined", () => {
      expect(() => {
        rateLimitService.checkRateLimit("user1", "undefined_action");
      }).not.toThrow();
    });

    it("should throw error when rate limit is exceeded", () => {
      // Use pause action with 3 attempts per minute
      for (let i = 0; i < 3; i++) {
        rateLimitService.checkRateLimit("user1", "pause");
      }

      expect(() => {
        rateLimitService.checkRateLimit("user1", "pause");
      }).toThrow(ApplicationError);
    });

    it("should throw ApplicationError with correct properties on rate limit", () => {
      for (let i = 0; i < 3; i++) {
        rateLimitService.checkRateLimit("user1", "pause");
      }

      try {
        rateLimitService.checkRateLimit("user1", "pause");
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

    it("should reset rate limit after window expires", () => {
      rateLimitService.setRule("test", { maxAttempts: 2, windowMs: 1000 });

      rateLimitService.checkRateLimit("user1", "test");
      rateLimitService.checkRateLimit("user1", "test");

      // Advance time beyond window
      jest.advanceTimersByTime(1001);

      expect(() => {
        rateLimitService.checkRateLimit("user1", "test");
      }).not.toThrow();
    });

    it("should track different users separately", () => {
      rateLimitService.setRule("test", { maxAttempts: 1, windowMs: 1000 });

      rateLimitService.checkRateLimit("user1", "test");
      expect(() => {
        rateLimitService.checkRateLimit("user2", "test");
      }).not.toThrow();
    });

    it("should track different actions separately", () => {
      rateLimitService.setRule("action1", { maxAttempts: 1, windowMs: 1000 });
      rateLimitService.setRule("action2", { maxAttempts: 1, windowMs: 1000 });

      rateLimitService.checkRateLimit("user1", "action1");
      expect(() => {
        rateLimitService.checkRateLimit("user1", "action2");
      }).not.toThrow();
    });

    it("should handle blocking when blockDurationMs is specified", () => {
      rateLimitService.setRule("blocktest", {
        maxAttempts: 1,
        windowMs: 1000,
        blockDurationMs: 5000,
      });

      rateLimitService.checkRateLimit("user1", "blocktest");

      expect(() => {
        rateLimitService.checkRateLimit("user1", "blocktest");
      }).toThrow(/blocked for 5 seconds/);
    });

    it("should maintain block even if window resets", () => {
      rateLimitService.setRule("blocktest", {
        maxAttempts: 1,
        windowMs: 1000,
        blockDurationMs: 5000,
      });

      rateLimitService.checkRateLimit("user1", "blocktest");

      try {
        rateLimitService.checkRateLimit("user1", "blocktest");
      } catch (error) {
        // Block should be active
      }

      // Advance time past window but not past block
      jest.advanceTimersByTime(2000);

      expect(() => {
        rateLimitService.checkRateLimit("user1", "blocktest");
      }).toThrow(/temporarily blocked/);
    });

    it("should allow after block expires", () => {
      rateLimitService.setRule("blocktest", {
        maxAttempts: 1,
        windowMs: 1000,
        blockDurationMs: 2000,
      });

      rateLimitService.checkRateLimit("user1", "blocktest");

      try {
        rateLimitService.checkRateLimit("user1", "blocktest");
      } catch (error) {
        // Expected block
      }

      // Advance time past block
      jest.advanceTimersByTime(2001);

      expect(() => {
        rateLimitService.checkRateLimit("user1", "blocktest");
      }).not.toThrow();
    });
  });

  describe("getRateLimitStatus", () => {
    it("should return correct status for undefined action", () => {
      const status = rateLimitService.getRateLimitStatus("user1", "undefined");
      expect(status).toEqual({
        remaining: Infinity,
        resetTime: 0,
        blocked: false,
      });
    });

    it("should return correct status for new user", () => {
      const now = Date.now();
      const status = rateLimitService.getRateLimitStatus("user1", "time");

      expect(status.remaining).toBe(10);
      expect(status.resetTime).toBeGreaterThanOrEqual(now);
      expect(status.blocked).toBe(false);
    });

    it("should return correct status after some attempts", () => {
      rateLimitService.checkRateLimit("user1", "time");
      rateLimitService.checkRateLimit("user1", "time");

      const status = rateLimitService.getRateLimitStatus("user1", "time");
      expect(status.remaining).toBe(8);
      expect(status.blocked).toBe(false);
    });

    it("should return correct status when blocked", () => {
      rateLimitService.setRule("blocktest", {
        maxAttempts: 1,
        windowMs: 1000,
        blockDurationMs: 5000,
      });

      rateLimitService.checkRateLimit("user1", "blocktest");

      try {
        rateLimitService.checkRateLimit("user1", "blocktest");
      } catch (error) {
        // Expected block
      }

      const status = rateLimitService.getRateLimitStatus("user1", "blocktest");
      expect(status.blocked).toBe(true);
      expect(status.blockedUntil).toBeDefined();
    });

    it("should return correct status after window reset", () => {
      rateLimitService.setRule("test", { maxAttempts: 2, windowMs: 1000 });

      rateLimitService.checkRateLimit("user1", "test");

      jest.advanceTimersByTime(1001);

      const status = rateLimitService.getRateLimitStatus("user1", "test");
      expect(status.remaining).toBe(2);
      expect(status.blocked).toBe(false);
    });
  });

  describe("resetUserRateLimit", () => {
    it("should reset specific action for user", () => {
      rateLimitService.checkRateLimit("user1", "time");
      rateLimitService.checkRateLimit("user1", "time");

      rateLimitService.resetUserRateLimit("user1", "time");

      const status = rateLimitService.getRateLimitStatus("user1", "time");
      expect(status.remaining).toBe(10);
    });

    it("should reset all actions for user when no action specified", () => {
      rateLimitService.checkRateLimit("user1", "time");
      rateLimitService.checkRateLimit("user1", "hours");

      rateLimitService.resetUserRateLimit("user1");

      const timeStatus = rateLimitService.getRateLimitStatus("user1", "time");
      const hoursStatus = rateLimitService.getRateLimitStatus("user1", "hours");

      expect(timeStatus.remaining).toBe(10);
      expect(hoursStatus.remaining).toBe(5);
    });

    it("should not affect other users", () => {
      rateLimitService.checkRateLimit("user1", "time");
      rateLimitService.checkRateLimit("user2", "time");

      rateLimitService.resetUserRateLimit("user1", "time");

      const user1Status = rateLimitService.getRateLimitStatus("user1", "time");
      const user2Status = rateLimitService.getRateLimitStatus("user2", "time");

      expect(user1Status.remaining).toBe(10);
      expect(user2Status.remaining).toBe(9);
    });
  });

  describe("cleanup behavior", () => {
    it("should track entries that expire naturally", () => {
      rateLimitService.setRule("test", { maxAttempts: 1, windowMs: 1000 });

      rateLimitService.checkRateLimit("user1", "test");

      let stats = rateLimitService.getStatistics();
      expect(stats.totalTrackedUsers).toBe(1);

      // Advance time past window - entries should still be tracked until cleanup
      jest.advanceTimersByTime(1001);

      stats = rateLimitService.getStatistics();
      expect(stats.totalTrackedUsers).toBe(1);
    });

    it("should maintain entries with active blocks even after window expires", () => {
      rateLimitService.setRule("blocktest", {
        maxAttempts: 1,
        windowMs: 1000,
        blockDurationMs: 10000,
      });

      rateLimitService.checkRateLimit("user1", "blocktest");

      try {
        rateLimitService.checkRateLimit("user1", "blocktest");
      } catch (error) {
        // Expected block
      }

      // Advance time past window but not past block
      jest.advanceTimersByTime(2000);

      const stats = rateLimitService.getStatistics();
      expect(stats.totalTrackedUsers).toBe(1);

      // Should still be blocked
      expect(() => {
        rateLimitService.checkRateLimit("user1", "blocktest");
      }).toThrow(/temporarily blocked/);
    });

    it("should setup cleanup interval on construction", () => {
      // The constructor already called setInterval - verify it was called
      expect(mockSetInterval).toHaveBeenCalledTimes(1);
      expect(mockSetInterval).toHaveBeenCalledWith(
        expect.any(Function),
        300000
      );
    });
  });

  describe("getStatistics", () => {
    it("should return correct statistics for empty service", () => {
      const stats = rateLimitService.getStatistics();
      expect(stats).toEqual({
        totalTrackedUsers: 0,
        totalRules: 6, // Default rules
        topActions: [],
      });
    });

    it("should count tracked users correctly", () => {
      rateLimitService.checkRateLimit("user1", "time");
      rateLimitService.checkRateLimit("user2", "time");
      rateLimitService.checkRateLimit("user1", "hours");

      const stats = rateLimitService.getStatistics();
      expect(stats.totalTrackedUsers).toBe(2);
    });

    it("should count total rules correctly", () => {
      rateLimitService.setRule("custom1", { maxAttempts: 1, windowMs: 1000 });
      rateLimitService.setRule("custom2", { maxAttempts: 1, windowMs: 1000 });

      const stats = rateLimitService.getStatistics();
      expect(stats.totalRules).toBe(8); // 6 default + 2 custom
    });

    it("should return top actions with attempt counts", () => {
      rateLimitService.checkRateLimit("user1", "time");
      rateLimitService.checkRateLimit("user1", "time");
      rateLimitService.checkRateLimit("user2", "time");
      rateLimitService.checkRateLimit("user1", "hours");

      const stats = rateLimitService.getStatistics();
      expect(stats.topActions).toHaveLength(2);
      expect(stats.topActions[0]).toEqual({ action: "time", attempts: 3 });
      expect(stats.topActions[1]).toEqual({ action: "hours", attempts: 1 });
    });

    it("should sort top actions by attempt count descending", () => {
      rateLimitService.checkRateLimit("user1", "hours");
      rateLimitService.checkRateLimit("user1", "time");
      rateLimitService.checkRateLimit("user1", "time");
      rateLimitService.checkRateLimit("user1", "time");

      const stats = rateLimitService.getStatistics();
      expect(stats.topActions[0].action).toBe("time");
      expect(stats.topActions[0].attempts).toBe(3);
      expect(stats.topActions[1].action).toBe("hours");
      expect(stats.topActions[1].attempts).toBe(1);
    });

    it("should limit top actions to 10", () => {
      // Create 15 different actions
      for (let i = 0; i < 15; i++) {
        rateLimitService.setRule(`action${i}`, {
          maxAttempts: 10,
          windowMs: 1000,
        });
        rateLimitService.checkRateLimit("user1", `action${i}`);
      }

      const stats = rateLimitService.getStatistics();
      expect(stats.topActions).toHaveLength(10);
    });
  });

  describe("error messages", () => {
    it("should include remaining time in rate limit error", () => {
      rateLimitService.setRule("test", { maxAttempts: 1, windowMs: 60000 });

      rateLimitService.checkRateLimit("user1", "test");

      try {
        rateLimitService.checkRateLimit("user1", "test");
      } catch (error) {
        expect((error as ApplicationError).message).toMatch(/wait \d+ seconds/);
      }
    });

    it("should include block duration in block error", () => {
      rateLimitService.setRule("test", {
        maxAttempts: 1,
        windowMs: 1000,
        blockDurationMs: 30000,
      });

      rateLimitService.checkRateLimit("user1", "test");

      try {
        rateLimitService.checkRateLimit("user1", "test");
      } catch (error) {
        expect((error as ApplicationError).message).toContain(
          "blocked for 30 seconds"
        );
      }
    });

    it("should show remaining block time in subsequent calls", () => {
      rateLimitService.setRule("test", {
        maxAttempts: 1,
        windowMs: 1000,
        blockDurationMs: 10000,
      });

      rateLimitService.checkRateLimit("user1", "test");

      try {
        rateLimitService.checkRateLimit("user1", "test");
      } catch (error) {
        // Initial block
      }

      jest.advanceTimersByTime(2000);

      try {
        rateLimitService.checkRateLimit("user1", "test");
      } catch (error) {
        expect((error as ApplicationError).message).toMatch(/wait \d+ seconds/);
        expect((error as ApplicationError).message).toContain(
          "temporarily blocked"
        );
      }
    });
  });
});

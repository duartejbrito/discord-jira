import {
  TimeUtils,
  TimeFormat,
  TimeDistribution,
} from "../../src/services/TimeUtils";

describe("TimeUtils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  describe("parseTimeToSeconds", () => {
    it("should parse seconds into time components", () => {
      const result: TimeFormat = TimeUtils.parseTimeToSeconds(3661);
      expect(result).toEqual({
        days: 0,
        hours: 1,
        minutes: 1,
        seconds: 1,
      });
    });

    it("should handle days correctly", () => {
      const result: TimeFormat = TimeUtils.parseTimeToSeconds(90061); // 1 day, 1 hour, 1 minute, 1 second
      expect(result).toEqual({
        days: 1,
        hours: 1,
        minutes: 1,
        seconds: 1,
      });
    });

    it("should handle zero seconds", () => {
      const result: TimeFormat = TimeUtils.parseTimeToSeconds(0);
      expect(result).toEqual({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
      });
    });
  });

  describe("formatTimeString", () => {
    it("should format seconds to human readable string", () => {
      expect(TimeUtils.formatTimeString(3661)).toBe("1h 1m");
      expect(TimeUtils.formatTimeString(3600)).toBe("1h");
      expect(TimeUtils.formatTimeString(60)).toBe("1m");
      expect(TimeUtils.formatTimeString(120)).toBe("2m");
    });

    it("should handle days in formatting", () => {
      expect(TimeUtils.formatTimeString(86400)).toBe("1d"); // 1 day = 24 * 3600
      expect(TimeUtils.formatTimeString(90000)).toBe("1d 1h"); // 1 day + 1 hour
      expect(TimeUtils.formatTimeString(176461)).toBe("2d 1h 1m"); // 2 days + 1 hour + 1 minute + 1 second
    });

    it("should handle edge cases", () => {
      expect(TimeUtils.formatTimeString(0)).toBe("0h");
      expect(TimeUtils.formatTimeString(1)).toBe("0h");
      expect(TimeUtils.formatTimeString(59)).toBe("0h");
    });
  });

  describe("distributeTimeEvenly", () => {
    it("should distribute time evenly with remainder", () => {
      const result: TimeDistribution = TimeUtils.distributeTimeEvenly(100, 3);

      expect(result.evenDistribution).toEqual([34, 33, 33]);
      expect(result.totalSeconds).toBe(100);
      expect(result.evenDistribution!.reduce((sum, val) => sum + val, 0)).toBe(
        100
      );
    });

    it("should handle perfect division", () => {
      const result: TimeDistribution = TimeUtils.distributeTimeEvenly(120, 4);

      expect(result.evenDistribution).toEqual([30, 30, 30, 30]);
      expect(result.totalSeconds).toBe(120);
      expect(result.evenDistribution!.reduce((sum, val) => sum + val, 0)).toBe(
        120
      );
    });

    it("should handle single issue", () => {
      const result: TimeDistribution = TimeUtils.distributeTimeEvenly(100, 1);

      expect(result.evenDistribution).toEqual([100]);
      expect(result.totalSeconds).toBe(100);
    });

    it("should handle zero seconds", () => {
      const result: TimeDistribution = TimeUtils.distributeTimeEvenly(0, 3);

      expect(result.evenDistribution).toEqual([0, 0, 0]);
      expect(result.totalSeconds).toBe(0);
    });
  });

  describe("distributeTimeFairly", () => {
    it("should distribute time fairly with predictable random", () => {
      const mockRandom = jest.fn().mockReturnValue(0.5);

      const result: TimeDistribution = TimeUtils.distributeTimeFairly(
        1800,
        3,
        mockRandom
      );

      expect(result.fairDistribution!.length).toBe(3);
      expect(result.totalSeconds).toBe(1800);
      expect(result.fairDistribution!.reduce((sum, val) => sum + val, 0)).toBe(
        1800
      );

      // Each value should be a multiple of 5 minutes (300 seconds)
      result.fairDistribution!.forEach((val) => {
        expect(val % 300).toBe(0);
      });
    });

    it("should handle single issue fairly", () => {
      const result: TimeDistribution = TimeUtils.distributeTimeFairly(900, 1);

      expect(result.fairDistribution).toEqual([900]);
      expect(result.totalSeconds).toBe(900);
    });

    it("should ensure total matches exactly", () => {
      const mockRandom = jest.fn().mockReturnValue(0.3);

      const result: TimeDistribution = TimeUtils.distributeTimeFairly(
        1000,
        2,
        mockRandom
      );

      expect(result.fairDistribution!.length).toBe(2);
      expect(result.totalSeconds).toBe(1000);
      expect(result.fairDistribution!.reduce((sum, val) => sum + val, 0)).toBe(
        1000
      );
    });

    it("should work with default random generator", () => {
      const result: TimeDistribution = TimeUtils.distributeTimeFairly(600, 2);

      expect(result.fairDistribution!.length).toBe(2);
      expect(result.totalSeconds).toBe(600);
      expect(result.fairDistribution!.reduce((sum, val) => sum + val, 0)).toBe(
        600
      );
    });

    it("should handle edge case with very small total seconds", () => {
      const result: TimeDistribution = TimeUtils.distributeTimeFairly(300, 2);

      expect(result.fairDistribution!.length).toBe(2);
      expect(result.totalSeconds).toBe(300);
      expect(result.fairDistribution!.reduce((sum, val) => sum + val, 0)).toBe(
        300
      );
    });

    it("should handle adjustment when total needs correction", () => {
      // Create a scenario where the adjustment loop is triggered
      const mockRandom = jest
        .fn()
        .mockReturnValueOnce(0.9) // Large first value
        .mockReturnValueOnce(0.1); // Small second value

      const result: TimeDistribution = TimeUtils.distributeTimeFairly(
        900,
        2,
        mockRandom
      );

      expect(result.fairDistribution!.length).toBe(2);
      expect(result.totalSeconds).toBe(900);
      expect(result.fairDistribution!.reduce((sum, val) => sum + val, 0)).toBe(
        900
      );
    });

    it("should handle negative adjustment case", () => {
      // This tests the negative diff branch in the adjustment loop
      const mockRandom = jest.fn().mockReturnValue(1.0); // Always maximum values initially

      const result: TimeDistribution = TimeUtils.distributeTimeFairly(
        600,
        3,
        mockRandom
      );

      expect(result.fairDistribution!.length).toBe(3);
      expect(result.totalSeconds).toBe(600);
      expect(result.fairDistribution!.reduce((sum, val) => sum + val, 0)).toBe(
        600
      );
    });
  });
});

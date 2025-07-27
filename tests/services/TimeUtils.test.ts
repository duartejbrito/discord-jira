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

    it("should handle complex adjustment scenarios requiring multiple iterations", () => {
      // Test case that requires multiple adjustment iterations
      const mockRandom = jest
        .fn()
        .mockReturnValueOnce(0.9) // First issue gets large value
        .mockReturnValueOnce(0.1) // Second issue gets small value
        .mockReturnValueOnce(0.5); // Third issue gets medium value

      const result: TimeDistribution = TimeUtils.distributeTimeFairly(
        1800, // 30 minutes
        3,
        mockRandom
      );

      expect(result.fairDistribution!.length).toBe(3);
      expect(result.totalSeconds).toBe(1800);
      // Must sum to exactly 1800
      expect(result.fairDistribution!.reduce((sum, val) => sum + val, 0)).toBe(
        1800
      );
    });

    it("should handle adjustment with remainders that require wrapping index", () => {
      // Create scenario where adjustment wraps around the index multiple times
      const mockRandom = jest.fn().mockReturnValue(0.33); // Middle values

      const result: TimeDistribution = TimeUtils.distributeTimeFairly(
        1807, // Odd number that doesn't divide evenly
        4,
        mockRandom
      );

      expect(result.fairDistribution!.length).toBe(4);
      expect(result.totalSeconds).toBe(1807);
      expect(result.fairDistribution!.reduce((sum, val) => sum + val, 0)).toBe(
        1807
      );
    });

    it("should trigger final adjustment loop when distribution total doesn't match", () => {
      // Create a complex scenario that forces the adjustment loop at lines 101-109
      // The key is to create a situation where the initial distribution total doesn't
      // match totalSeconds, which should be rare but possible with certain edge cases

      // Use a custom mock that creates an edge case scenario
      let callCount = 0;
      const edgeCaseMockRandom = jest.fn(() => {
        callCount++;
        // Create a scenario where the algorithm might not perfectly balance
        // Use specific values that could lead to precision/rounding issues
        if (callCount === 1) return 0.999; // Always pick the largest minute option (30*60=1800)
        if (callCount === 2) return 0.001; // Always pick the smallest minute option (5*60=300)
        if (callCount === 3) return 0.5; // Middle option
        return 0.0; // Default to smallest for any additional calls
      });

      // Use a total that is likely to create a mismatch when distributed with these random values
      // The algorithm should try to fit 1800 + 300 + remainders, which might not align perfectly
      const totalSeconds = 1950; // Not evenly divisible by any minute option
      const numIssues = 3;

      const result: TimeDistribution = TimeUtils.distributeTimeFairly(
        totalSeconds,
        numIssues,
        edgeCaseMockRandom
      );

      // Verify the result is valid regardless of whether adjustment was needed
      expect(result.fairDistribution!.length).toBe(numIssues);
      expect(result.totalSeconds).toBe(totalSeconds);
      expect(result.fairDistribution!.reduce((sum, val) => sum + val, 0)).toBe(
        totalSeconds
      );

      // Verify all distribution values are non-negative integers
      result.fairDistribution!.forEach((val) => {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(val)).toBe(true);
      });

      // The critical part: if the adjustment loop was triggered, it should still produce
      // a valid distribution that sums to totalSeconds
      expect(result.fairDistribution!.every((val) => val >= 0)).toBe(true);
    });

    it("should handle edge case that definitely triggers adjustment loop", () => {
      // Create an artificial scenario by manually manipulating the algorithm's flow
      // We'll use a totalSeconds value that's guaranteed to cause issues

      // Create a mock that forces the algorithm into a state where adjustment is needed
      // By always returning the same index, we can create uneven distribution
      const mockRandom = jest.fn().mockReturnValue(0.0); // Always 5*60 = 300 seconds

      // Use a total that when divided by 300 leaves a remainder
      const totalSeconds = 1001; // 1001 = 3*300 + 101, so remainder = 101
      const numIssues = 4;

      const result: TimeDistribution = TimeUtils.distributeTimeFairly(
        totalSeconds,
        numIssues,
        mockRandom
      );

      // The algorithm should handle this correctly even if adjustment is needed
      expect(result.fairDistribution!.length).toBe(numIssues);
      expect(result.totalSeconds).toBe(totalSeconds);
      expect(result.fairDistribution!.reduce((sum, val) => sum + val, 0)).toBe(
        totalSeconds
      );

      // Verify the distribution is valid
      result.fairDistribution!.forEach((val) => {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(val)).toBe(true);
      });
    });

    it("should handle adjustment loop when distribution total doesn't match", () => {
      // Create a scenario that forces the adjustment loop to run
      // We'll manipulate the random function to create a mismatch

      let callCount = 0;
      const adjustmentMockRandom = jest.fn(() => {
        callCount++;
        // Return values that will create an imbalanced distribution
        // that doesn't sum to the target
        if (callCount <= 2) return 0.0; // Small amounts (5*60 = 300)
        return 0.999; // Large amounts (30*60 = 1800)
      });

      // Use specific values that will create a total mismatch
      const totalSeconds = 2701; // A value that will require adjustment
      const numIssues = 2;

      const result: TimeDistribution = TimeUtils.distributeTimeFairly(
        totalSeconds,
        numIssues,
        adjustmentMockRandom
      );

      // The adjustment should ensure the total is exactly right
      expect(result.fairDistribution!.length).toBe(numIssues);
      expect(result.totalSeconds).toBe(totalSeconds);
      expect(result.fairDistribution!.reduce((sum, val) => sum + val, 0)).toBe(
        totalSeconds
      );

      // Verify all values are still valid after adjustment
      result.fairDistribution!.forEach((val) => {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(val)).toBe(true);
      });
    });

    it("should handle negative adjustment in adjustment loop", () => {
      // Create a scenario where the adjustment needs to subtract time
      const negativeAdjustmentMock = jest.fn(() => 0.999); // Always pick largest (30*60 = 1800)

      // Use a total that will be smaller than what gets distributed initially
      const totalSeconds = 1500; // Less than 1800, so will need negative adjustment
      const numIssues = 1;

      const result: TimeDistribution = TimeUtils.distributeTimeFairly(
        totalSeconds,
        numIssues,
        negativeAdjustmentMock
      );

      // The adjustment should handle negative diff correctly
      expect(result.fairDistribution!.length).toBe(numIssues);
      expect(result.totalSeconds).toBe(totalSeconds);
      expect(result.fairDistribution!.reduce((sum, val) => sum + val, 0)).toBe(
        totalSeconds
      );

      // Value should be adjusted down to match totalSeconds
      expect(result.fairDistribution![0]).toBe(totalSeconds);
    });
  });
});

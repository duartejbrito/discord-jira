import { TimeUtils } from "../../src/services/TimeUtils";
import {
  convertSeconds,
  distributeSeconds,
  distributeTime,
  formatString,
} from "../../src/services/utils";

// Mock the TimeUtils to control behavior
jest.mock("../../src/services/TimeUtils");
const mockTimeUtils = TimeUtils as jest.Mocked<typeof TimeUtils>;

describe("Refactored Utils Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("convertSeconds", () => {
    it("should use TimeUtils.formatTimeString", () => {
      mockTimeUtils.formatTimeString.mockReturnValue("1h 30m");

      const result = convertSeconds(5400);

      expect(mockTimeUtils.formatTimeString).toHaveBeenCalledWith(5400);
      expect(result).toBe("1h 30m");
    });
  });

  describe("distributeSeconds", () => {
    it("should use TimeUtils.distributeTimeEvenly", () => {
      const mockDistribution = {
        evenDistribution: [1800, 1800, 1800],
        totalSeconds: 5400,
      };
      mockTimeUtils.distributeTimeEvenly.mockReturnValue(mockDistribution);

      const result = distributeSeconds(5400, 3);

      expect(mockTimeUtils.distributeTimeEvenly).toHaveBeenCalledWith(5400, 3);
      expect(result).toEqual([1800, 1800, 1800]); // distributeSeconds returns only the array
    });

    it("should return empty array when evenDistribution is null", () => {
      // This test covers line 14 - the || [] fallback case
      const mockDistribution = {
        evenDistribution: undefined,
        totalSeconds: 0,
      };
      mockTimeUtils.distributeTimeEvenly.mockReturnValue(mockDistribution);

      const result = distributeSeconds(0, 1);

      expect(mockTimeUtils.distributeTimeEvenly).toHaveBeenCalledWith(0, 1);
      expect(result).toEqual([]); // Should return empty array when evenDistribution is undefined
    });
  });

  describe("distributeTime", () => {
    it("should use even distribution by default", () => {
      const mockDistribution = {
        evenDistribution: [1800, 1800, 1800],
        totalSeconds: 5400,
      };
      mockTimeUtils.distributeTimeEvenly.mockReturnValue(mockDistribution);

      const result = distributeTime(5400, 3);

      expect(mockTimeUtils.distributeTimeEvenly).toHaveBeenCalledWith(5400, 3);
      expect(result).toEqual([1800, 1800, 1800]);
    });

    it("should use even distribution when method is 'evenly'", () => {
      const mockDistribution = {
        evenDistribution: [1800, 1800, 1800],
        totalSeconds: 5400,
      };
      mockTimeUtils.distributeTimeEvenly.mockReturnValue(mockDistribution);

      const result = distributeTime(5400, 3, "evenly");

      expect(mockTimeUtils.distributeTimeEvenly).toHaveBeenCalledWith(5400, 3);
      expect(result).toEqual([1800, 1800, 1800]);
    });

    it("should use fair distribution when method is 'fairly'", () => {
      const mockDistribution = {
        fairDistribution: [1700, 1900, 1800],
        totalSeconds: 5400,
      };
      mockTimeUtils.distributeTimeFairly.mockReturnValue(mockDistribution);

      const result = distributeTime(5400, 3, "fairly");

      expect(mockTimeUtils.distributeTimeFairly).toHaveBeenCalledWith(5400, 3);
      expect(result).toEqual([1700, 1900, 1800]);
    });

    it("should return empty array when even distribution is null", () => {
      const mockDistribution = {
        evenDistribution: null as unknown as number[],
        totalSeconds: 5400,
      };
      mockTimeUtils.distributeTimeEvenly.mockReturnValue(mockDistribution);

      const result = distributeTime(5400, 3, "evenly");

      expect(mockTimeUtils.distributeTimeEvenly).toHaveBeenCalledWith(5400, 3);
      expect(result).toEqual([]);
    });

    it("should return empty array when fair distribution is null", () => {
      const mockDistribution = {
        fairDistribution: null as unknown as number[],
        totalSeconds: 5400,
      };
      mockTimeUtils.distributeTimeFairly.mockReturnValue(mockDistribution);

      const result = distributeTime(5400, 3, "fairly");

      expect(mockTimeUtils.distributeTimeFairly).toHaveBeenCalledWith(5400, 3);
      expect(result).toEqual([]);
    });
  });

  describe("formatString", () => {
    it("should format string with placeholders", () => {
      const result = formatString(
        "Hello {0}! Welcome to {1}.",
        "John",
        "Discord"
      );

      expect(result).toBe("Hello John! Welcome to Discord.");
    });

    it("should handle missing arguments", () => {
      const result = formatString("Hello {0}! Welcome to {1}.", "John");

      expect(result).toBe("Hello John! Welcome to {1}.");
    });

    it("should handle no placeholders", () => {
      const result = formatString("Hello World!", "unused");

      expect(result).toBe("Hello World!");
    });

    it("should handle multiple instances of same placeholder", () => {
      const result = formatString("{0} {0} {0}", "Hello");

      expect(result).toBe("Hello Hello Hello");
    });

    it("should handle out-of-order placeholders", () => {
      const result = formatString("{1} {0}", "World", "Hello");

      expect(result).toBe("Hello World");
    });
  });

  describe("String.prototype.format extension", () => {
    it("should add format method to String prototype", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(typeof (String.prototype as any).format).toBe("function");
    });

    it("should format using prototype method", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = ("Hello {0}!" as any).format("World");

      expect(result).toBe("Hello World!");
    });

    it("should be configurable to prevent conflicts", () => {
      const descriptor = Object.getOwnPropertyDescriptor(
        String.prototype,
        "format"
      );

      expect(descriptor?.configurable).toBe(true);
      expect(descriptor?.enumerable).toBe(false);
    });

    it("should not override existing format method", () => {
      // Create an existing format method first
      const existingFormat = jest.fn();
      Object.defineProperty(String.prototype, "format", {
        value: existingFormat,
        enumerable: false,
        configurable: true,
        writable: true,
      });

      // Store the original function
      const originalSetup =
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require("../../src/services/utils").setupStringFormatExtension;

      // Call setup - should not override existing format method
      originalSetup();

      // The existing format method should still be there (not overridden)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((String.prototype as any).format).toBe(existingFormat);

      // Clean up by removing the format method
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (String.prototype as any).format;
    });

    it("should create format method when it doesn't exist", () => {
      // Ensure format method is removed first
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (String.prototype as any).format;

      // Store the original function
      const { setupStringFormatExtension } =
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require("../../src/services/utils");

      // Call setup - should create format method
      setupStringFormatExtension();

      // The format method should now exist
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((String.prototype as any).format).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(typeof (String.prototype as any).format).toBe("function");

      // Test that it works
      const testString = "Hello {0}, you have {1} messages";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (testString as any).format("John", "5");
      expect(result).toBe("Hello John, you have 5 messages");

      // Clean up by removing the format method
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (String.prototype as any).format;
    });
  });
});

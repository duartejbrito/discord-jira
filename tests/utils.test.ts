// Mock node-fetch before importing the module
jest.mock("node-fetch");

import { convertSeconds, distributeTime } from "../src/services/utils";

describe("Utils Functions", () => {
  describe("convertSeconds", () => {
    it("should convert seconds to hours and minutes format", () => {
      expect(convertSeconds(3661)).toBe("1h 1m");
      expect(convertSeconds(3600)).toBe("1h");
      expect(convertSeconds(60)).toBe("1m");
      expect(convertSeconds(120)).toBe("2m");
      expect(convertSeconds(7380)).toBe("2h 3m");
    });

    it("should handle days correctly", () => {
      expect(convertSeconds(86400)).toBe("1d");
      expect(convertSeconds(90000)).toBe("1d 1h");
      expect(convertSeconds(172800)).toBe("2d");
      expect(convertSeconds(176461)).toBe("2d 1h 1m");
    });

    it("should handle edge cases", () => {
      expect(convertSeconds(0)).toBe("0h");
      expect(convertSeconds(1)).toBe("0h");
      expect(convertSeconds(59)).toBe("0h");
    });
  });

  describe("distributeTime", () => {
    describe("evenly method", () => {
      it("should distribute seconds evenly", () => {
        const result = distributeTime(100, 3, "evenly");
        expect(result).toEqual([34, 33, 33]);
        expect(result.reduce((sum, val) => sum + val, 0)).toBe(100);
      });

      it("should handle perfect division", () => {
        const result = distributeTime(120, 4, "evenly");
        expect(result).toEqual([30, 30, 30, 30]);
        expect(result.reduce((sum, val) => sum + val, 0)).toBe(120);
      });

      it("should handle single issue", () => {
        const result = distributeTime(100, 1, "evenly");
        expect(result).toEqual([100]);
        expect(result.reduce((sum, val) => sum + val, 0)).toBe(100);
      });

      it("should handle zero seconds", () => {
        const result = distributeTime(0, 3, "evenly");
        expect(result).toEqual([0, 0, 0]);
        expect(result.reduce((sum, val) => sum + val, 0)).toBe(0);
      });
    });

    describe("fairly method", () => {
      beforeEach(() => {
        // Mock Math.random to ensure predictable results
        jest.spyOn(Math, "random").mockReturnValue(0.5);
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      it("should distribute seconds fairly", () => {
        const result = distributeTime(1800, 3, "fairly"); // 30 minutes
        expect(result.length).toBe(3);
        expect(result.reduce((sum, val) => sum + val, 0)).toBe(1800);
        // Each value should be a multiple of 5 minutes (300 seconds)
        result.forEach((val) => {
          expect(val % 300).toBe(0);
        });
      });

      it("should handle single issue fairly", () => {
        const result = distributeTime(900, 1, "fairly"); // 15 minutes
        expect(result).toEqual([900]);
        expect(result.reduce((sum, val) => sum + val, 0)).toBe(900);
      });

      it("should adjust total to match exactly", () => {
        const result = distributeTime(1000, 2, "fairly");
        expect(result.length).toBe(2);
        expect(result.reduce((sum, val) => sum + val, 0)).toBe(1000);
      });
    });

    it("should return array with correct length", () => {
      expect(distributeTime(100, 5, "evenly")).toHaveLength(5);
      expect(distributeTime(100, 5, "fairly")).toHaveLength(5);
    });
  });
});

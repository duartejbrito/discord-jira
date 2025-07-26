// Utility functions using TimeUtils business logic
import { TimeUtils } from "./TimeUtils";

export function convertSeconds(totalSeconds: number): string {
  return TimeUtils.formatTimeString(totalSeconds);
}

// Backward compatibility for old distributeSeconds function
export function distributeSeconds(
  totalSeconds: number,
  numIssues: number
): number[] {
  const result = TimeUtils.distributeTimeEvenly(totalSeconds, numIssues);
  return result.evenDistribution || [];
}

// Type definitions for time distribution
export interface TimeDistribution {
  evenDistribution: number[];
  totalSeconds: number;
}

// Utility function to distribute time with different strategies
export function distributeTime(
  totalSeconds: number,
  numIssues: number,
  method: "evenly" | "fairly" = "evenly"
): number[] {
  if (method === "fairly") {
    const result = TimeUtils.distributeTimeFairly(totalSeconds, numIssues);
    return result.fairDistribution || [];
  }
  const result = TimeUtils.distributeTimeEvenly(totalSeconds, numIssues);
  return result.evenDistribution || [];
}

// String formatting utility (preserving legacy String.prototype.format)
export function formatString(template: string, ...args: string[]): string {
  return template.replace(/{(\d+)}/g, (match: string, number: number) => {
    return typeof args[number] !== "undefined" ? args[number] : match;
  });
}

// Setup function to initialize String.prototype.format extension
export function setupStringFormatExtension(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(String.prototype as any).format) {
    Object.defineProperty(String.prototype, "format", {
      value: function (...args: string[]) {
        return formatString(this as string, ...args);
      },
      enumerable: false,
      configurable: true,
    });
  }
}

// Auto-setup the string format extension when this module is imported
setupStringFormatExtension();

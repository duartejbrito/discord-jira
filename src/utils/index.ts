import * as logger from "./logger";

declare global {
  interface String {
    // eslint-disable-next-line no-unused-vars
    format(...args: string[]): string;
  }
}

Object.defineProperty(String.prototype, "format", {
  value: function (...args: string[]) {
    return this.replace(/{(\d+)}/g, (match: string, number: number) => {
      return typeof args[number] !== "undefined" ? args[number] : match;
    });
  },
  enumerable: false,
});

export function convertSeconds(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / (24 * 3600));
  totalSeconds %= 24 * 3600;
  const hours = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  const minutes = Math.floor(totalSeconds / 60);

  let result = "";
  if (days > 1) {
    result += `${days}d `;
  }
  result += `${hours}h `;
  if (minutes > 1) {
    result += `${minutes}m `;
  }

  return result.trim();
}

export function distributeSeconds(
  totalSeconds: number,
  numIssues: number,
  method: "evenly" | "fairly"
): number[] {
  const distribution = new Array(numIssues).fill(0);

  if (method === "evenly") {
    const evenShare = Math.floor(totalSeconds / numIssues);
    const remainder = totalSeconds % numIssues;

    for (let i = 0; i < numIssues; i++) {
      distribution[i] = evenShare;
    }

    for (let i = 0; i < remainder; i++) {
      distribution[i]++;
    }
  } else if (method === "fairly") {
    const minuteOptions = [5 * 60, 10 * 60, 15 * 60, 20 * 60, 25 * 60, 30 * 60]; // Options in seconds
    let remainingSeconds = totalSeconds;
    let index = 0;

    while (remainingSeconds > 0) {
      const addSeconds =
        minuteOptions[Math.floor(Math.random() * minuteOptions.length)];
      if (remainingSeconds >= addSeconds) {
        distribution[index] += addSeconds;
        remainingSeconds -= addSeconds;
      } else {
        distribution[index] += remainingSeconds;
        remainingSeconds = 0;
      }
      index = (index + 1) % numIssues;
    }

    // Adjust to ensure the total is exactly totalSeconds
    let currentTotal = distribution.reduce((acc, val) => acc + val, 0);
    while (currentTotal !== totalSeconds) {
      const diff = totalSeconds - currentTotal;
      const adjustment = Math.min(Math.abs(diff), minuteOptions[0]);
      if (diff > 0) {
        distribution[index] += adjustment;
      } else {
        distribution[index] -= adjustment;
      }
      currentTotal = distribution.reduce((acc, val) => acc + val, 0);
      index = (index + 1) % numIssues;
    }
  }

  return distribution;
}

export const utils = {
  logger,
};

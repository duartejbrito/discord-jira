// Business logic for utility functions - pure functions for easy testing

export interface TimeDistribution {
  evenDistribution?: number[];
  fairDistribution?: number[];
  totalSeconds: number;
}

export interface TimeFormat {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export class TimeUtils {
  static parseTimeToSeconds(totalSeconds: number): TimeFormat {
    const days = Math.floor(totalSeconds / (24 * 3600));
    let remainingSeconds = totalSeconds % (24 * 3600);

    const hours = Math.floor(remainingSeconds / 3600);
    remainingSeconds %= 3600;

    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;

    return { days, hours, minutes, seconds };
  }

  static formatTimeString(totalSeconds: number): string {
    const { days, hours, minutes } = TimeUtils.parseTimeToSeconds(totalSeconds);

    let result = "";
    if (days > 0) {
      result += `${days}d `;
    }
    if (hours > 0) {
      result += `${hours}h `;
    }
    if (minutes > 0) {
      result += `${minutes}m `;
    }

    // If no components found, show at least "0h"
    if (result === "") {
      result = "0h ";
    }

    return result.trim();
  }

  static distributeTimeEvenly(
    totalSeconds: number,
    numIssues: number
  ): TimeDistribution {
    const distribution = new Array(numIssues).fill(0);

    const evenShare = Math.floor(totalSeconds / numIssues);
    const remainder = totalSeconds % numIssues;

    for (let i = 0; i < numIssues; i++) {
      distribution[i] = evenShare;
    }

    for (let i = 0; i < remainder; i++) {
      distribution[i]++;
    }

    return {
      evenDistribution: distribution,
      totalSeconds,
    };
  }

  static distributeTimeFairly(
    totalSeconds: number,
    numIssues: number,
    randomGenerator: () => number = Math.random
  ): TimeDistribution {
    const distribution = new Array(numIssues).fill(0);
    const minuteOptions = [5 * 60, 10 * 60, 15 * 60, 20 * 60, 25 * 60, 30 * 60];
    let remainingSeconds = totalSeconds;
    let index = 0;

    while (remainingSeconds > 0) {
      const addSeconds =
        minuteOptions[Math.floor(randomGenerator() * minuteOptions.length)];
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

    return {
      fairDistribution: distribution,
      totalSeconds,
    };
  }
}

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

export const utils = {
  logger,
};

// Global setup for tests - handle String.prototype extensions

// Only add the format method if it doesn't already exist
if (!(String.prototype as any).format) {
  Object.defineProperty(String.prototype, "format", {
    value: function (...args: string[]) {
      return this.replace(/{(\d+)}/g, (match: string, number: number) => {
        return typeof args[number] !== "undefined" ? args[number] : match;
      });
    },
    enumerable: false,
    configurable: true,
  });
}

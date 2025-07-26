// Type extensions for String prototype
declare global {
  interface String {
    // eslint-disable-next-line no-unused-vars
    format(...args: string[]): string;
  }
}

export {};

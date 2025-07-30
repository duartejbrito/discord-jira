import dotenv from "dotenv";
import { expand } from "dotenv-expand";

/* eslint-disable no-unused-vars */
export interface IConfigService {
  get(key: string): string | undefined;
  getRequired(key: string): string;

  // Utility methods for common config values
  getDiscordToken(): string;
  getDiscordClientId(): string;
  getClientId(): string;
  getOwnerUserId(): string;
  getOwnerGuildId(): string;
  getOwnerLogChannelId(): string | undefined;
  getDatabaseUrl(): string;
  getPgConnectionString(): string | undefined;
  isDiscordLoggingEnabled(): boolean;
  isPgLoggingEnabled(): boolean;
  isProduction(): boolean;
  isDevelopment(): boolean;
  isTest(): boolean;
}
/* eslint-enable no-unused-vars */

export class ConfigService implements IConfigService {
  private static instance: IConfigService;

  constructor() {
    if (ConfigService.instance) {
      throw new Error(
        "ConfigService is a singleton and cannot be instantiated multiple times."
      );
    }

    expand(dotenv.config());
  }

  static getInstance(): IConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  get(key: string): string | undefined {
    return process.env[key];
  }

  getRequired(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
  }

  // Utility methods for common config values
  getDiscordToken(): string {
    return this.getRequired("DISCORD_TOKEN");
  }

  getDiscordClientId(): string {
    return this.getRequired("DISCORD_CLIENT_ID");
  }

  getClientId(): string {
    return this.getRequired("CLIENT_ID");
  }

  getOwnerUserId(): string {
    return this.getRequired("OWNER_ID");
  }

  getOwnerGuildId(): string {
    return this.getRequired("OWNER_GUILD_ID");
  }

  getOwnerLogChannelId(): string | undefined {
    return this.get("OWNER_LOG_CHANNEL_ID");
  }

  getDatabaseUrl(): string {
    return this.get("DATABASE_URL") || ":memory:";
  }

  getPgConnectionString(): string | undefined {
    return this.get("PG_CONNECTION_STRING");
  }

  isDiscordLoggingEnabled(): boolean {
    const value = this.get("DISCORD_LOGGING");
    return value ? value === "true" : false;
  }

  isPgLoggingEnabled(): boolean {
    const value = this.get("PG_LOGGING");
    return value ? value === "true" : false;
  }

  isProduction(): boolean {
    return this.get("NODE_ENV") === "production";
  }

  isDevelopment(): boolean {
    return this.get("NODE_ENV") === "development";
  }

  isTest(): boolean {
    return (
      this.get("NODE_ENV") === "test" ||
      process.env.JEST_WORKER_ID !== undefined
    );
  }
}

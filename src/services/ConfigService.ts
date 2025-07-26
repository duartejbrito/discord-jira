import { IConfigService } from "./interfaces";

export class ConfigService implements IConfigService {
  private static instance: ConfigService;

  static getInstance(): ConfigService {
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

  getClientId(): string {
    return this.getRequired("CLIENT_ID");
  }

  getOwnerUserId(): string {
    return this.getRequired("OWNER_USER_ID");
  }

  getOwnerGuildId(): string {
    return this.getRequired("OWNER_GUILD_ID");
  }

  getDatabaseUrl(): string {
    return this.get("DATABASE_URL") || ":memory:";
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

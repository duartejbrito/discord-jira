import { ConfigService } from "../../src/services/ConfigService";
import { IConfigService } from "../../src/services/interfaces";

describe("ConfigService", () => {
  let configService: IConfigService;
  let originalEnv: NodeJS.ProcessEnv;

  // Helper function to set environment variables
  const setEnv = (key: string, value: string) => {
    process.env[key] = value;
  };

  const deleteEnv = (key: string) => {
    delete process.env[key];
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Store original environment
    originalEnv = { ...process.env };

    // Get fresh instance and cast to concrete class for testing specific methods
    configService = ConfigService.getInstance();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("singleton pattern", () => {
    it("should return the same instance", () => {
      const instance1 = ConfigService.getInstance();
      const instance2 = ConfigService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe("get method", () => {
    it("should return environment variable value", () => {
      const testValue = "test-value";
      setEnv("TEST_VAR", testValue);

      const result = configService.get("TEST_VAR");

      expect(result).toBe(testValue);
    });

    it("should return undefined for non-existent variable", () => {
      const result = configService.get("NON_EXISTENT_VAR");

      expect(result).toBeUndefined();
    });
  });

  describe("getRequired method", () => {
    it("should return environment variable value when it exists", () => {
      const testValue = "required-value";
      setEnv("REQUIRED_VAR", testValue);

      const result = configService.getRequired("REQUIRED_VAR");

      expect(result).toBe(testValue);
    });

    it("should throw error when required variable is missing", () => {
      deleteEnv("MISSING_VAR");

      expect(() => {
        configService.getRequired("MISSING_VAR");
      }).toThrow("Required environment variable MISSING_VAR is not set");
    });

    it("should throw error when required variable is empty string", () => {
      setEnv("EMPTY_VAR", "");

      expect(() => {
        configService.getRequired("EMPTY_VAR");
      }).toThrow("Required environment variable EMPTY_VAR is not set");
    });
  });

  describe("utility methods", () => {
    it("should get Discord token", () => {
      const testToken = "discord-token";
      setEnv("DISCORD_TOKEN", testToken);

      const result = configService.getDiscordToken();

      expect(result).toBe(testToken);
    });

    it("should get client ID", () => {
      const testClientId = "client-123";
      setEnv("CLIENT_ID", testClientId);

      const result = configService.getClientId();

      expect(result).toBe(testClientId);
    });

    it("should get owner user ID", () => {
      process.env.OWNER_ID = "owner-456";

      const result = configService.getOwnerUserId();

      expect(result).toBe("owner-456");
    });

    it("should get owner guild ID", () => {
      process.env.OWNER_GUILD_ID = "guild-789";

      const result = configService.getOwnerGuildId();

      expect(result).toBe("guild-789");
    });

    it("should get database URL with default", () => {
      delete process.env.DATABASE_URL;

      const result = configService.getDatabaseUrl();

      expect(result).toBe(":memory:");
    });

    it("should get custom database URL", () => {
      process.env.DATABASE_URL = "sqlite:///custom.db";

      const result = configService.getDatabaseUrl();

      expect(result).toBe("sqlite:///custom.db");
    });
  });

  describe("environment detection", () => {
    it("should detect production environment", () => {
      process.env.NODE_ENV = "production";
      delete process.env.JEST_WORKER_ID;

      expect(configService.isProduction()).toBe(true);
      expect(configService.isDevelopment()).toBe(false);
      expect(configService.isTest()).toBe(false);
    });

    it("should detect development environment", () => {
      process.env.NODE_ENV = "development";
      delete process.env.JEST_WORKER_ID;

      expect(configService.isProduction()).toBe(false);
      expect(configService.isDevelopment()).toBe(true);
      expect(configService.isTest()).toBe(false);
    });

    it("should detect test environment from NODE_ENV", () => {
      process.env.NODE_ENV = "test";
      delete process.env.JEST_WORKER_ID;

      expect(configService.isProduction()).toBe(false);
      expect(configService.isDevelopment()).toBe(false);
      expect(configService.isTest()).toBe(true);
    });

    it("should detect test environment from Jest worker", () => {
      delete process.env.NODE_ENV;
      process.env.JEST_WORKER_ID = "1";

      expect(configService.isTest()).toBe(true);
    });
  });
});

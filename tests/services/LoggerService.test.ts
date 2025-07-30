/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ILoggerService,
  LoggerService,
  LogType,
} from "../../src/services/LoggerService";

// Mock colors/safe
jest.mock("colors/safe", () => ({
  blue: jest.fn((str: string) => str),
  magenta: jest.fn((str: string) => str),
  red: jest.fn((str: string) => str),
  yellow: jest.fn((str: string) => str),
}));

// Mock discord.js
jest.mock("discord.js", () => ({
  Colors: {
    Blue: 0x3498db,
    Yellow: 0xffff00,
    Red: 0xff0000,
    Blurple: 0x5865f2,
  },
  EmbedBuilder: jest.fn().mockImplementation(() => ({
    setColor: jest.fn(),
    setTitle: jest.fn(),
    setFooter: jest.fn(),
    setTimestamp: jest.fn(),
    addFields: jest.fn(),
  })),
}));

describe("LoggerService", () => {
  let loggerService: ILoggerService;
  let mockClient: any;
  let mockChannel: any;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    // Cast to concrete class for testing specific methods
    loggerService = LoggerService.getInstance();
    consoleSpy = jest.spyOn(console, "log").mockImplementation();

    mockChannel = {
      send: jest.fn().mockResolvedValue({ delete: jest.fn() }),
    };

    mockClient = {
      channels: {
        cache: {
          get: jest.fn().mockReturnValue(mockChannel),
        },
      },
      user: {
        tag: "TestBot#1234",
        displayAvatarURL: jest
          .fn()
          .mockReturnValue("https://example.com/avatar.png"),
      },
    };
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe("Singleton behavior", () => {
    it("should return the same instance", () => {
      const instance1 = LoggerService.getInstance();
      const instance2 = LoggerService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("Initialization", () => {
    it("should initialize with Discord client and configuration", () => {
      loggerService.initialize(mockClient, "123456789", true);

      expect(mockClient.channels.cache.get).toHaveBeenCalledWith("123456789");
    });

    it("should work without Discord logging enabled", () => {
      loggerService.initialize(mockClient, "123456789", false);

      expect(mockClient.channels.cache.get).toHaveBeenCalledWith("123456789");
    });

    it("should initialize with default discordLogging parameter", () => {
      // Test calling initialize without the third parameter to test default value
      loggerService.initialize(mockClient, "123456789");

      expect(mockClient.channels.cache.get).toHaveBeenCalledWith("123456789");
    });
  });

  describe("Logging methods", () => {
    beforeEach(() => {
      loggerService.initialize(mockClient, "123456789", false);
    });

    it("should log info messages", () => {
      loggerService.info("Test info message", { key: "value" });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[INFO]")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test info message")
      );
    });

    it("should log warning messages", () => {
      loggerService.warn("Test warning message");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[WARN]")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test warning message")
      );
    });

    it("should log error messages", () => {
      loggerService.error("Test error message");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ERROR]")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test error message")
      );
    });

    it("should log debug messages", () => {
      loggerService.debug("Test debug message");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[DEBUG]")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test debug message")
      );
    });

    it("should handle Error objects", () => {
      const testError = new Error("Test error");
      loggerService.error(testError);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test error")
      );
    });

    it("should include additional arguments in log output", () => {
      loggerService.info("Test message", { userId: 123, action: "test" });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("{\"userId\":123,\"action\":\"test\"}")
      );
    });
  });

  describe("Backward compatibility methods", () => {
    beforeEach(() => {
      loggerService.initialize(mockClient, "123456789", false);
    });

    it("should support legacy logInfo method", () => {
      loggerService.logInfo("Legacy info message");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[INFO]")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Legacy info message")
      );
    });

    it("should support legacy logError method", () => {
      loggerService.logError("Legacy error message");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ERROR]")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Legacy error message")
      );
    });

    it("should support legacy logWarn method", () => {
      loggerService.logWarn("Legacy warning message");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[WARN]")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Legacy warning message")
      );
    });

    it("should support legacy logDebug method", () => {
      loggerService.logDebug("Legacy debug message");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[DEBUG]")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Legacy debug message")
      );
    });
  });

  describe("Discord logging", () => {
    beforeEach(() => {
      loggerService.initialize(mockClient, "123456789", true);
    });

    it("should send Discord messages when Discord logging is enabled", async () => {
      loggerService.info("Discord test message");

      // Wait a bit for async Discord logging
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockChannel.send).toHaveBeenCalled();
    });

    it("should not send Discord messages when channel is not available", () => {
      mockClient.channels.cache.get.mockReturnValue(null);
      loggerService.initialize(mockClient, "123456789", true);

      loggerService.info("Test message");

      expect(mockChannel.send).not.toHaveBeenCalled();
    });

    it("should add fields to Discord embed when args are provided", async () => {
      loggerService.initialize(mockClient, "123456789", true);

      const testArgs = {
        testKey: "testValue",
        anotherKey: { nested: "object" },
        emptyKey: null,
      };

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { EmbedBuilder } = require("discord.js");
      const mockEmbedInstance = {
        setColor: jest.fn().mockReturnThis(),
        setTitle: jest.fn().mockReturnThis(),
        setFooter: jest.fn().mockReturnThis(),
        setTimestamp: jest.fn().mockReturnThis(),
        addFields: jest.fn().mockReturnThis(),
      };

      EmbedBuilder.mockReturnValue(mockEmbedInstance);

      loggerService.info("Test message with args", testArgs);

      // Wait for async Discord logging
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockEmbedInstance.addFields).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: "testKey",
            value: JSON.stringify("testValue"),
            inline: true,
          }),
          expect.objectContaining({
            name: "anotherKey",
            value: JSON.stringify({ nested: "object" }),
            inline: true,
          }),
          expect.objectContaining({
            name: "emptyKey",
            value: " ",
            inline: true,
          }),
        ])
      );
    });
  });

  describe("LogType enum", () => {
    it("should export LogType enum correctly", () => {
      expect(LogType.INFO).toBe(0);
      expect(LogType.WARN).toBe(1);
      expect(LogType.ERROR).toBe(2);
      expect(LogType.DEBUG).toBe(3);
    });
  });

  describe("Legacy interface methods", () => {
    beforeEach(() => {
      loggerService.initialize(mockClient, "123456789", false);
    });

    it("should handle logInfo method without args parameter", () => {
      loggerService.logInfo("Test info message");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[INFO]")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test info message")
      );
    });

    it("should handle logWarn method without args parameter", () => {
      loggerService.logWarn("Test warning message");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[WARN]")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test warning message")
      );
    });

    it("should handle logDebug method without args parameter", () => {
      loggerService.logDebug("Test debug message");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[DEBUG]")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test debug message")
      );
    });

    it("should handle logError method without args parameter", () => {
      loggerService.logError("Test error message");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ERROR]")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test error message")
      );
    });

    it("should handle logError method with Error object and no args", () => {
      const error = new Error("Test error");
      loggerService.logError(error);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ERROR]")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test error")
      );
    });
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */
import { MessageFlags } from "discord.js";
import { execute, data } from "../../src/commands/hours";
import { JiraConfig } from "../../src/db/models/JiraConfig";
import { ServiceContainer } from "../../src/services/ServiceContainer";
import {
  createMockInteraction,
  createMockServiceContainer,
} from "../test-utils";

// Mock dependencies
jest.mock("../../src/services/ServiceContainer");
jest.mock("../../src/db/models/JiraConfig");

// Unmock SlashCommandBuilder for this test so we get actual command data
jest.unmock("discord.js");

describe("Hours Command", () => {
  let mockInteraction: any;
  let mockContainer: any;
  let mockServices: any;

  beforeEach(() => {
    mockInteraction = createMockInteraction();
    const mockContainerSetup = createMockServiceContainer();
    mockContainer = mockContainerSetup.mockContainer;
    mockServices = mockContainerSetup.mockServices;

    (ServiceContainer.getInstance as jest.Mock).mockReturnValue(mockContainer);

    jest.clearAllMocks();
  });

  describe("Command Data", () => {
    it("should have correct command configuration", () => {
      // Test data exports exist
      expect(data).toBeDefined();
      expect(typeof data.toJSON).toBe("function");

      const commandData = data.toJSON();
      expect(commandData.name).toBe("hours");
      expect(commandData.description).toBe(
        "Configure your daily hours for time logging."
      );
      expect(commandData.options).toBeDefined();
      expect(commandData.options).toHaveLength(1);

      if (commandData.options && commandData.options.length > 0) {
        const hoursOption = commandData.options[0];
        expect(hoursOption.name).toBe("hours");
        expect(hoursOption.description).toBe(
          "The number of daily hours to distribute across tickets."
        );
        expect(hoursOption.required).toBe(true);
        expect(hoursOption.type).toBe(4); // INTEGER type
      }
    });

    it("should export the correct name", () => {
      expect(typeof data.setName).toBe("function");
      expect(typeof data.setDescription).toBe("function");
      expect(typeof data.addIntegerOption).toBe("function");
    });
  });

  describe("Command Execution", () => {
    it("should update daily hours for existing config", async () => {
      const mockConfig = {
        guildId: "123456789012345678",
        host: "test.atlassian.net",
        username: "testuser",
        token: "testtoken",
        userId: "987654321098765432",
        dailyHours: 8,
        save: jest.fn().mockResolvedValue(undefined),
      };

      mockInteraction.options.get.mockReturnValue({ value: 6 });
      (JiraConfig.findOne as jest.Mock).mockResolvedValue(mockConfig);

      await execute(mockInteraction);

      expect(JiraConfig.findOne).toHaveBeenCalledWith({
        where: {
          guildId: mockInteraction.guildId,
          userId: mockInteraction.user.id,
        },
      });
      expect(mockConfig.dailyHours).toBe(6);
      expect(mockConfig.save).toHaveBeenCalled();
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content:
          "Your daily hours have been updated to 6 hours. This will be used for automatic time distribution in scheduled jobs and the /time command when hours are not specified.",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should return error if no config exists", async () => {
      mockInteraction.options.get.mockReturnValue({ value: 6 });
      (JiraConfig.findOne as jest.Mock).mockResolvedValue(null);

      await execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content:
          "No Jira configuration found for this user. Please run `/setup` first.",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should log command execution", async () => {
      const mockConfig = {
        guildId: "123456789012345678",
        host: "test.atlassian.net",
        username: "testuser",
        token: "testtoken",
        userId: "987654321098765432",
        dailyHours: 8,
        save: jest.fn().mockResolvedValue(undefined),
      };

      mockInteraction.options.get.mockReturnValue({ value: 10 });
      (JiraConfig.findOne as jest.Mock).mockResolvedValue(mockConfig);

      await execute(mockInteraction);

      expect(mockServices.ILoggerService.logInfo).toHaveBeenCalledWith(
        "Executing hours command",
        {
          GuildId: mockInteraction.guildId,
          UserId: mockInteraction.user.id,
        }
      );
    });

    it("should handle different hour values", async () => {
      const mockConfig = {
        guildId: "123456789012345678",
        host: "test.atlassian.net",
        username: "testuser",
        token: "testtoken",
        userId: "987654321098765432",
        dailyHours: 8,
        save: jest.fn().mockResolvedValue(undefined),
      };

      mockInteraction.options.get.mockReturnValue({ value: 4 });
      (JiraConfig.findOne as jest.Mock).mockResolvedValue(mockConfig);

      await execute(mockInteraction);

      expect(mockConfig.dailyHours).toBe(4);
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content:
          "Your daily hours have been updated to 4 hours. This will be used for automatic time distribution in scheduled jobs and the /time command when hours are not specified.",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should handle boundary values correctly", async () => {
      const mockConfig = {
        guildId: "123456789012345678",
        host: "test.atlassian.net",
        username: "testuser",
        token: "testtoken",
        userId: "987654321098765432",
        dailyHours: 8,
        save: jest.fn().mockResolvedValue(undefined),
      };

      // Test minimum value (1 hour)
      mockInteraction.options.get.mockReturnValue({ value: 1 });
      (JiraConfig.findOne as jest.Mock).mockResolvedValue(mockConfig);

      await execute(mockInteraction);

      expect(mockConfig.dailyHours).toBe(1);
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content:
          "Your daily hours have been updated to 1 hours. This will be used for automatic time distribution in scheduled jobs and the /time command when hours are not specified.",
        flags: MessageFlags.Ephemeral,
      });

      // Reset mocks for next test
      jest.clearAllMocks();
      mockConfig.dailyHours = 8; // Reset to default

      // Test maximum value (24 hours)
      mockInteraction.options.get.mockReturnValue({ value: 24 });
      (JiraConfig.findOne as jest.Mock).mockResolvedValue(mockConfig);

      await execute(mockInteraction);

      expect(mockConfig.dailyHours).toBe(24);
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content:
          "Your daily hours have been updated to 24 hours. This will be used for automatic time distribution in scheduled jobs and the /time command when hours are not specified.",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should handle database save errors gracefully", async () => {
      const mockConfig = {
        guildId: "123456789012345678",
        host: "test.atlassian.net",
        username: "testuser",
        token: "testtoken",
        userId: "987654321098765432",
        dailyHours: 8,
        save: jest.fn().mockRejectedValue(new Error("Database error")),
      };

      mockInteraction.options.get.mockReturnValue({ value: 6 });
      (JiraConfig.findOne as jest.Mock).mockResolvedValue(mockConfig);

      await expect(execute(mockInteraction)).resolves.not.toThrow();

      expect(mockConfig.save).toHaveBeenCalled();
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringMatching(
            /^❌ \*\*Unexpected Error\*\*.*Error ID:/s
          ),
          flags: MessageFlags.Ephemeral,
        })
      );
    });

    it("should handle database lookup errors gracefully", async () => {
      mockInteraction.options.get.mockReturnValue({ value: 6 });
      (JiraConfig.findOne as jest.Mock).mockRejectedValue(
        new Error("Database connection error")
      );

      await expect(execute(mockInteraction)).resolves.not.toThrow();

      expect(JiraConfig.findOne).toHaveBeenCalledWith({
        where: {
          guildId: mockInteraction.guildId,
          userId: mockInteraction.user.id,
        },
      });
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringMatching(
            /^❌ \*\*Unexpected Error\*\*.*Error ID:/s
          ),
          flags: MessageFlags.Ephemeral,
        })
      );
    });

    it("should always log command execution even when config is not found", async () => {
      mockInteraction.options.get.mockReturnValue({ value: 6 });
      (JiraConfig.findOne as jest.Mock).mockResolvedValue(null);

      await execute(mockInteraction);

      expect(mockServices.ILoggerService.logInfo).toHaveBeenCalledWith(
        "Executing hours command",
        {
          GuildId: mockInteraction.guildId,
          UserId: mockInteraction.user.id,
        }
      );
    });

    it("should extract hours value correctly from interaction", async () => {
      const mockConfig = {
        guildId: "123456789012345678",
        host: "test.atlassian.net",
        username: "testuser",
        token: "testtoken",
        userId: "987654321098765432",
        dailyHours: 8,
        save: jest.fn().mockResolvedValue(undefined),
      };

      mockInteraction.options.get.mockReturnValue({ value: 12 });
      (JiraConfig.findOne as jest.Mock).mockResolvedValue(mockConfig);

      await execute(mockInteraction);

      // Verify that the options.get was called with correct parameters
      expect(mockInteraction.options.get).toHaveBeenCalledWith("hours", true);
      expect(mockConfig.dailyHours).toBe(12);
    });
  });
});

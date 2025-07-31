/* eslint-disable @typescript-eslint/no-explicit-any */
import { MessageFlags } from "discord.js";
import { execute } from "../../src/commands/info";
import { JiraConfig } from "../../src/db/models/JiraConfig";
import { InputValidator } from "../../src/services/InputValidator";
import { ServiceContainer } from "../../src/services/ServiceContainer";
import {
  createMockInteraction,
  createMockServiceContainer,
} from "../test-utils";

// Mock the database model
jest.mock("../../src/db/models/JiraConfig");
const mockJiraConfig = JiraConfig as jest.Mocked<typeof JiraConfig>;

// Mock the ServiceContainer
jest.mock("../../src/services/ServiceContainer");

// Mock InputValidator
jest.mock("../../src/services/InputValidator");

describe("Info Command", () => {
  let mockInteraction: any;
  let mockContainer: any;
  let mockServices: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock InputValidator.sanitizeInput to return input as-is
    (InputValidator.sanitizeInput as jest.Mock) = jest
      .fn()
      .mockImplementation((input: string) => input);

    // Use test utilities for consistent mock setup
    const containerSetup = createMockServiceContainer();
    mockContainer = containerSetup.mockContainer;
    mockServices = containerSetup.mockServices;

    // Mock the ServiceContainer.getInstance method
    (ServiceContainer.getInstance as jest.Mock).mockReturnValue(mockContainer);

    // Create mock interaction
    mockInteraction = createMockInteraction({
      guildId: "123456789012345678",
      user: {
        id: "987654321098765432",
        username: "testuser",
        displayAvatarURL: jest
          .fn()
          .mockReturnValue("https://example.com/avatar.png"),
      },
    });
  });

  describe("when user has no configuration", () => {
    beforeEach(() => {
      mockJiraConfig.findOne.mockResolvedValue(null);
    });

    it("should inform user that no configuration exists", async () => {
      await execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        embeds: [
          expect.objectContaining({
            title: "⚠️ Configuration Not Found",
            description: "No Jira configuration found for this user.",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should log the command execution", async () => {
      await execute(mockInteraction);

      expect(mockServices.ILoggerService.logInfo).toHaveBeenCalledWith(
        "Executing info command",
        {
          GuildId: "123456789012345678",
          UserId: "987654321098765432",
        }
      );
    });

    it("should query the database with correct parameters", async () => {
      await execute(mockInteraction);

      expect(mockJiraConfig.findOne).toHaveBeenCalledWith({
        where: { guildId: "123456789012345678", userId: "987654321098765432" },
      });
    });
  });

  describe("when user has configuration", () => {
    const mockConfig = {
      host: "https://test.atlassian.net",
      username: "testuser@example.com",
      token: "test-token",
      timeJqlOverride: "custom-jql",
      schedulePaused: false,
      dailyHours: 8,
    };

    beforeEach(() => {
      mockJiraConfig.findOne.mockResolvedValue(mockConfig as any);
    });

    it("should display configuration information", async () => {
      await execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        embeds: [
          expect.objectContaining({
            title: "📋 Your Jira Configuration",
            description: expect.stringContaining(
              "current Jira integration settings"
            ),
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should include all configuration details", async () => {
      await execute(mockInteraction);

      const callArgs = (mockInteraction.reply as jest.Mock).mock.calls[0][0];
      expect(callArgs.embeds).toBeDefined();
      expect(callArgs.embeds[0]).toMatchObject({
        title: "📋 Your Jira Configuration",
        fields: expect.arrayContaining([
          expect.objectContaining({ name: "🌐 Host" }),
          expect.objectContaining({ name: "👤 Username" }),
          expect.objectContaining({ name: "🔑 API Token" }),
        ]),
      });
    });

    it("should log the command execution", async () => {
      await execute(mockInteraction);

      expect(mockServices.ILoggerService.logInfo).toHaveBeenCalledWith(
        "Executing info command",
        {
          GuildId: "123456789012345678",
          UserId: "987654321098765432",
        }
      );
    });
  });

  describe("when configuration is inactive", () => {
    const mockInactiveConfig = {
      host: "https://test.atlassian.net",
      username: "testuser@example.com",
      token: "test-token",
      timeJqlOverride: null,
      schedulePaused: true,
      dailyHours: 6,
    };

    beforeEach(() => {
      mockJiraConfig.findOne.mockResolvedValue(mockInactiveConfig as any);
    });

    it("should show paused status", async () => {
      await execute(mockInteraction);

      const callArgs = (mockInteraction.reply as jest.Mock).mock.calls[0][0];
      expect(callArgs.embeds).toBeDefined();
      expect(callArgs.embeds[0]).toMatchObject({
        title: "📋 Your Jira Configuration",
        fields: expect.arrayContaining([
          expect.objectContaining({
            name: "⏸️ Schedule Status",
            value: expect.stringContaining("Paused"),
          }),
        ]),
      });
    });
  });

  describe("error handling", () => {
    it("should handle database errors gracefully", async () => {
      mockJiraConfig.findOne.mockRejectedValue(new Error("Database error"));

      await expect(execute(mockInteraction)).resolves.not.toThrow();

      // Verify that an error response was sent to the user
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringMatching(
            /^❌ \*\*Unexpected Error\*\*.*Error ID:/s
          ),
          flags: expect.any(Number),
        })
      );
    });

    it("should handle service container errors", async () => {
      (ServiceContainer.getInstance as jest.Mock).mockImplementation(() => {
        throw new Error("Service container not initialized");
      });

      await expect(execute(mockInteraction)).resolves.not.toThrow();

      // Verify that an error response was sent to the user
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringMatching(
            /^❌ \*\*Unexpected Error\*\*.*Error ID:/s
          ),
          flags: expect.any(Number),
        })
      );
    });
  });
});

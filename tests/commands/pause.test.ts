/* eslint-disable @typescript-eslint/no-explicit-any */
import { MessageFlags } from "discord.js";
import { execute } from "../../src/commands/pause";
import { JiraConfig } from "../../src/db/models";
import { ServiceContainer } from "../../src/services/ServiceContainer";
import {
  createMockInteraction,
  createMockServiceContainer,
} from "../test-utils";

// Mock the database model
jest.mock("../../src/db/models");
const mockJiraConfig = JiraConfig as jest.Mocked<typeof JiraConfig>;

// Mock the ServiceContainer
jest.mock("../../src/services/ServiceContainer");

describe("Pause Command", () => {
  let mockInteraction: any;
  let mockContainer: any;
  let mockServices: any;

  beforeEach(() => {
    jest.clearAllMocks();

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
        "Executing pause command",
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

  describe("when user has active configuration", () => {
    const mockActiveConfig = {
      host: "https://test.atlassian.net",
      username: "testuser@example.com",
      schedulePaused: false,
      update: jest.fn().mockResolvedValue(undefined),
    };

    beforeEach(() => {
      mockJiraConfig.findOne.mockResolvedValue(mockActiveConfig as any);
      mockActiveConfig.update.mockClear();
    });

    it("should pause the configuration", async () => {
      await execute(mockInteraction);

      expect(mockActiveConfig.update).toHaveBeenCalledWith({
        schedulePaused: true,
      });
    });

    it("should confirm the pause action", async () => {
      await execute(mockInteraction);

      // The config was NOT paused (false), so after updating it becomes paused (true)
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        embeds: [
          expect.objectContaining({
            title: "⏸️ Scheduled Jobs Paused",
            description: expect.stringContaining("paused"),
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should log the command execution", async () => {
      await execute(mockInteraction);

      expect(mockServices.ILoggerService.logInfo).toHaveBeenCalledWith(
        "Executing pause command",
        {
          GuildId: "123456789012345678",
          UserId: "987654321098765432",
        }
      );
    });
  });

  describe("when user has paused configuration", () => {
    const mockPausedConfig = {
      host: "https://test.atlassian.net",
      username: "testuser@example.com",
      schedulePaused: true,
      update: jest.fn().mockResolvedValue(undefined),
    };

    beforeEach(() => {
      mockJiraConfig.findOne.mockResolvedValue(mockPausedConfig as any);
      mockPausedConfig.update.mockClear();
    });

    it("should resume the configuration", async () => {
      await execute(mockInteraction);

      expect(mockPausedConfig.update).toHaveBeenCalledWith({
        schedulePaused: false,
      });
    });

    it("should confirm the resume action", async () => {
      await execute(mockInteraction);

      // The config was paused (true), so after updating it becomes unpaused (false)
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        embeds: [
          expect.objectContaining({
            title: "▶️ Scheduled Jobs Resumed",
            description: expect.stringContaining("resumed"),
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    });
  });

  describe("error handling", () => {
    it("should handle database errors gracefully", async () => {
      mockJiraConfig.findOne.mockRejectedValue(new Error("Database error"));

      // The execute function should handle the error gracefully, not throw
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
      (ServiceContainer.getInstance as jest.Mock) = jest
        .fn()
        .mockImplementation(() => {
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

    it("should handle update errors", async () => {
      const mockConfig = {
        host: "https://test.atlassian.net",
        username: "testuser@example.com",
        schedulePaused: false,
        update: jest.fn().mockRejectedValue(new Error("Update error")),
      };

      mockJiraConfig.findOne.mockResolvedValue(mockConfig as any);

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

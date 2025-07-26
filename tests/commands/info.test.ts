/* eslint-disable @typescript-eslint/no-explicit-any */
import { MessageFlags } from "discord.js";
import { execute } from "../../src/commands/info";
import { JiraConfig } from "../../src/db/models/JiraConfig";
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

describe("Info Command", () => {
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
      guildId: "123456789",
      user: { id: "user123" },
    });
  });

  describe("when user has no configuration", () => {
    beforeEach(() => {
      mockJiraConfig.findOne.mockResolvedValue(null);
    });

    it("should inform user that no configuration exists", async () => {
      await execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: "No Jira configuration found for this user.",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should log the command execution", async () => {
      await execute(mockInteraction);

      expect(mockServices.LoggerService.logInfo).toHaveBeenCalledWith(
        "Executing info command",
        {
          GuildId: "123456789",
          UserId: "user123",
        }
      );
    });

    it("should query the database with correct parameters", async () => {
      await execute(mockInteraction);

      expect(mockJiraConfig.findOne).toHaveBeenCalledWith({
        where: { guildId: "123456789", userId: "user123" },
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
    };

    beforeEach(() => {
      mockJiraConfig.findOne.mockResolvedValue(mockConfig as any);
    });

    it("should display configuration information", async () => {
      await execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining(
          "Here is your Jira configuration information:"
        ),
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should include all configuration details", async () => {
      await execute(mockInteraction);

      const callArgs = (mockInteraction.reply as jest.Mock).mock.calls[0][0];
      expect(callArgs.content).toContain("https://test.atlassian.net");
      expect(callArgs.content).toContain("testuser@example.com");
      expect(callArgs.content).toContain("test-token");
      expect(callArgs.content).toContain("custom-jql");
      expect(callArgs.content).toContain("Schedule Paused: No");
    });

    it("should log the command execution", async () => {
      await execute(mockInteraction);

      expect(mockServices.LoggerService.logInfo).toHaveBeenCalledWith(
        "Executing info command",
        {
          GuildId: "123456789",
          UserId: "user123",
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
    };

    beforeEach(() => {
      mockJiraConfig.findOne.mockResolvedValue(mockInactiveConfig as any);
    });

    it("should show paused status", async () => {
      await execute(mockInteraction);

      const callArgs = (mockInteraction.reply as jest.Mock).mock.calls[0][0];
      expect(callArgs.content).toContain("Schedule Paused: Yes");
    });
  });

  describe("error handling", () => {
    it("should handle database errors gracefully", async () => {
      mockJiraConfig.findOne.mockRejectedValue(new Error("Database error"));

      await expect(execute(mockInteraction)).rejects.toThrow("Database error");
    });

    it("should handle service container errors", async () => {
      (ServiceContainer.getInstance as jest.Mock).mockImplementation(() => {
        throw new Error("Service container not initialized");
      });

      await expect(execute(mockInteraction)).rejects.toThrow(
        "Service container not initialized"
      );
    });
  });
});

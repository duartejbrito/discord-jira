/* eslint-disable @typescript-eslint/no-explicit-any */
import { MessageFlags } from "discord.js";
import { execute, data, name } from "../../src/commands/setup";
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

// Unmock SlashCommandBuilder for this test so we get actual command data
jest.unmock("discord.js");

describe("Setup Command", () => {
  let mockInteraction: any;
  let mockContainer: any;
  let mockServices: any;

  describe("Command Data", () => {
    it("should have correct command configuration", () => {
      // Test data exports exist
      expect(data).toBeDefined();
      expect(typeof data.toJSON).toBe("function");

      const commandData = data.toJSON();
      expect(commandData.name).toBe("setup");
      expect(commandData.description).toBe(
        "Setup a Jira configuration for your user."
      );
      expect(commandData.options).toBeDefined();
      expect(commandData.options).toHaveLength(5);

      if (commandData.options && commandData.options.length >= 5) {
        // Test host option
        const hostOption = commandData.options[0];
        expect(hostOption.name).toBe("host");
        expect(hostOption.description).toBe("The host of your Jira instance.");
        expect(hostOption.required).toBe(true);
        expect(hostOption.type).toBe(3); // STRING type

        // Test username option
        const usernameOption = commandData.options[1];
        expect(usernameOption.name).toBe("username");
        expect(usernameOption.description).toBe("Your Jira username.");
        expect(usernameOption.required).toBe(true);
        expect(usernameOption.type).toBe(3); // STRING type

        // Test token option
        const tokenOption = commandData.options[2];
        expect(tokenOption.name).toBe("token");
        expect(tokenOption.description).toBe("Your Jira API token.");
        expect(tokenOption.required).toBe(true);
        expect(tokenOption.type).toBe(3); // STRING type

        // Test jql option (optional)
        const jqlOption = commandData.options[3];
        expect(jqlOption.name).toBe("jql");
        expect(jqlOption.description).toBe(
          "The JQL query to use for searching."
        );
        expect(jqlOption.required).toBe(false);
        expect(jqlOption.type).toBe(3); // STRING type

        // Test daily-hours option (optional)
        const dailyHoursOption = commandData.options[4];
        expect(dailyHoursOption.name).toBe("daily-hours");
        expect(dailyHoursOption.description).toBe(
          "Daily hours to distribute across tickets (default: 8)."
        );
        expect(dailyHoursOption.required).toBe(false);
        expect(dailyHoursOption.type).toBe(4); // INTEGER type
      }
    });

    it("should export the correct name", () => {
      expect(name).toBe("setup");
      expect(typeof data.setName).toBe("function");
      expect(typeof data.setDescription).toBe("function");
      expect(typeof data.addStringOption).toBe("function");
      expect(typeof data.addIntegerOption).toBe("function");
    });

    it("should have proper builder methods", () => {
      // Verify that the SlashCommandBuilder has the expected methods
      expect(typeof data.setContexts).toBe("function");
      expect(typeof data.setDefaultMemberPermissions).toBe("function");
      expect(typeof data.toJSON).toBe("function");
    });
  });

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
      options: {
        get: jest.fn(),
      },
    });
  });

  describe("when creating new configuration", () => {
    beforeEach(() => {
      (mockInteraction.options.get as jest.Mock)
        .mockReturnValueOnce({ value: "https://test.atlassian.net" }) // host
        .mockReturnValueOnce({ value: "testuser@example.com" }) // username
        .mockReturnValueOnce({ value: "test-token" }) // token
        .mockReturnValueOnce({ value: "project = TEST" }); // jql

      mockServices.IJiraService.getServerInfo.mockResolvedValue({ ok: true });

      const mockConfig = {
        guildId: "123456789",
        host: "https://test.atlassian.net",
        username: "testuser@example.com",
        token: "test-token",
        userId: "user123",
        timeJqlOverride: "project = TEST",
        schedulePaused: false,
        save: jest.fn().mockResolvedValue(undefined),
      };

      mockJiraConfig.findOrCreate.mockResolvedValue([mockConfig as any, true]);
    });

    it("should defer reply on start", async () => {
      await execute(mockInteraction);

      expect(mockInteraction.deferReply).toHaveBeenCalledWith({
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should validate Jira connection", async () => {
      await execute(mockInteraction);

      expect(mockServices.IJiraService.getServerInfo).toHaveBeenCalledWith(
        "https://test.atlassian.net",
        "testuser@example.com",
        "test-token"
      );
    });

    it("should create new configuration when successful", async () => {
      await execute(mockInteraction);

      expect(mockJiraConfig.findOrCreate).toHaveBeenCalledWith({
        where: {
          guildId: "123456789",
          userId: "user123",
        },
        defaults: {
          guildId: "123456789",
          host: "https://test.atlassian.net",
          username: "testuser@example.com",
          token: "test-token",
          userId: "user123",
          timeJqlOverride: "project = TEST",
          schedulePaused: false,
          dailyHours: 8,
        },
      });
    });

    it("should confirm successful setup", async () => {
      await execute(mockInteraction);

      expect(mockInteraction.followUp).toHaveBeenCalledWith({
        content: "Your Jira configuration has been saved.",
        flags: MessageFlags.Ephemeral,
      });
    });
  });

  describe("when updating existing configuration", () => {
    beforeEach(() => {
      (mockInteraction.options.get as jest.Mock)
        .mockReturnValueOnce({ value: "https://updated.atlassian.net" }) // host
        .mockReturnValueOnce({ value: "updated@example.com" }) // username
        .mockReturnValueOnce({ value: "updated-token" }) // token
        .mockReturnValueOnce({ value: "project = UPDATED" }); // jql

      mockServices.IJiraService.getServerInfo.mockResolvedValue({ ok: true });

      const mockConfig = {
        guildId: "123456789",
        host: "https://old.atlassian.net",
        username: "old@example.com",
        token: "old-token",
        userId: "user123",
        timeJqlOverride: "project = OLD",
        schedulePaused: false,
        save: jest.fn().mockResolvedValue(undefined),
      };

      mockJiraConfig.findOrCreate.mockResolvedValue([mockConfig as any, false]);
    });

    it("should update existing configuration", async () => {
      await execute(mockInteraction);

      const [config] = await mockJiraConfig.findOrCreate.mock.results[0].value;
      expect(config.host).toBe("https://updated.atlassian.net");
      expect(config.username).toBe("updated@example.com");
      expect(config.token).toBe("updated-token");
      expect(config.timeJqlOverride).toBe("project = UPDATED");
      expect(config.save).toHaveBeenCalled();
    });

    it("should confirm successful update", async () => {
      await execute(mockInteraction);

      expect(mockInteraction.followUp).toHaveBeenCalledWith({
        content: "Your Jira configuration has been saved.",
        flags: MessageFlags.Ephemeral,
      });
    });
  });

  describe("when setup without JQL override", () => {
    beforeEach(() => {
      (mockInteraction.options.get as jest.Mock)
        .mockReturnValueOnce({ value: "https://test.atlassian.net" }) // host
        .mockReturnValueOnce({ value: "testuser@example.com" }) // username
        .mockReturnValueOnce({ value: "test-token" }) // token
        .mockReturnValueOnce(null); // jql (optional)

      mockServices.IJiraService.getServerInfo.mockResolvedValue({ ok: true });

      const mockConfig = {
        guildId: "123456789",
        host: "https://test.atlassian.net",
        username: "testuser@example.com",
        token: "test-token",
        userId: "user123",
        timeJqlOverride: undefined,
        schedulePaused: false,
        save: jest.fn().mockResolvedValue(undefined),
      };

      mockJiraConfig.findOrCreate.mockResolvedValue([mockConfig as any, true]);
    });

    it("should create configuration without JQL override", async () => {
      await execute(mockInteraction);

      expect(mockJiraConfig.findOrCreate).toHaveBeenCalledWith({
        where: {
          guildId: "123456789",
          userId: "user123",
        },
        defaults: {
          guildId: "123456789",
          host: "https://test.atlassian.net",
          username: "testuser@example.com",
          token: "test-token",
          userId: "user123",
          timeJqlOverride: undefined,
          schedulePaused: false,
          dailyHours: 8,
        },
      });
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      (mockInteraction.options.get as jest.Mock)
        .mockReturnValueOnce({ value: "https://invalid.atlassian.net" })
        .mockReturnValueOnce({ value: "invalid@example.com" })
        .mockReturnValueOnce({ value: "invalid-token" })
        .mockReturnValueOnce(null);
    });

    it("should handle Jira connection failure", async () => {
      mockServices.IJiraService.getServerInfo.mockResolvedValue({
        ok: false,
        statusText: "Unauthorized",
      });

      await execute(mockInteraction);

      expect(mockInteraction.followUp).toHaveBeenCalledWith({
        content: "Failed to connect to Jira: Unauthorized",
        flags: MessageFlags.Ephemeral,
      });

      expect(mockJiraConfig.findOrCreate).not.toHaveBeenCalled();
    });

    it("should handle Jira connection failure with different error messages", async () => {
      mockServices.IJiraService.getServerInfo.mockResolvedValue({
        ok: false,
        statusText: "Not Found",
      });

      await execute(mockInteraction);

      expect(mockInteraction.followUp).toHaveBeenCalledWith({
        content: "Failed to connect to Jira: Not Found",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should handle service container errors", async () => {
      (ServiceContainer.getInstance as jest.Mock) = jest
        .fn()
        .mockImplementation(() => {
          throw new Error("Service container not initialized");
        });

      await expect(execute(mockInteraction)).rejects.toThrow(
        "Service container not initialized"
      );
    });

    it("should handle database errors", async () => {
      mockServices.IJiraService.getServerInfo.mockResolvedValue({ ok: true });
      mockJiraConfig.findOrCreate.mockRejectedValue(
        new Error("Database error")
      );

      await expect(execute(mockInteraction)).rejects.toThrow("Database error");
    });

    it("should handle save errors when updating configuration", async () => {
      mockServices.IJiraService.getServerInfo.mockResolvedValue({ ok: true });

      const mockConfig = {
        guildId: "123456789",
        host: "https://old.atlassian.net",
        username: "old@example.com",
        token: "old-token",
        userId: "user123",
        timeJqlOverride: null,
        schedulePaused: false,
        save: jest.fn().mockRejectedValue(new Error("Save failed")),
      };

      mockJiraConfig.findOrCreate.mockResolvedValue([mockConfig as any, false]);

      await expect(execute(mockInteraction)).rejects.toThrow("Save failed");
    });

    it("should handle missing guildId", async () => {
      // Test edge case where guildId might be null
      mockInteraction.guildId = null;

      mockServices.IJiraService.getServerInfo.mockResolvedValue({ ok: true });

      // This should not throw but will be handled by the non-null assertion
      // In real scenarios, guildId is guaranteed for guild commands
      await expect(execute(mockInteraction)).rejects.toThrow();
    });
  });

  describe("when setting daily hours", () => {
    it("should save custom daily hours when provided", async () => {
      (mockInteraction.options.get as jest.Mock)
        .mockReturnValueOnce({ value: "https://test.atlassian.net" }) // host
        .mockReturnValueOnce({ value: "testuser@example.com" }) // username
        .mockReturnValueOnce({ value: "test-token" }) // token
        .mockReturnValueOnce({ value: "project = TEST" }) // jql
        .mockReturnValueOnce({ value: 6 }); // daily-hours

      mockServices.IJiraService.getServerInfo.mockResolvedValue({ ok: true });

      const mockConfig = {
        guildId: "123456789",
        host: "https://test.atlassian.net",
        username: "testuser@example.com",
        token: "test-token",
        userId: "user123",
        timeJqlOverride: "project = TEST",
        schedulePaused: false,
        dailyHours: 6,
        save: jest.fn().mockResolvedValue(undefined),
      };

      mockJiraConfig.findOrCreate.mockResolvedValue([mockConfig as any, true]);

      await execute(mockInteraction);

      expect(mockJiraConfig.findOrCreate).toHaveBeenCalledWith({
        where: {
          guildId: "123456789",
          userId: "user123",
        },
        defaults: {
          guildId: "123456789",
          host: "https://test.atlassian.net",
          username: "testuser@example.com",
          token: "test-token",
          userId: "user123",
          timeJqlOverride: "project = TEST",
          schedulePaused: false,
          dailyHours: 6,
        },
      });
    });

    it("should default to 8 hours when daily-hours not provided", async () => {
      (mockInteraction.options.get as jest.Mock)
        .mockReturnValueOnce({ value: "https://test.atlassian.net" }) // host
        .mockReturnValueOnce({ value: "testuser@example.com" }) // username
        .mockReturnValueOnce({ value: "test-token" }) // token
        .mockReturnValueOnce({ value: "project = TEST" }) // jql
        .mockReturnValueOnce(null); // daily-hours (not provided)

      mockServices.IJiraService.getServerInfo.mockResolvedValue({ ok: true });

      const mockConfig = {
        guildId: "123456789",
        host: "https://test.atlassian.net",
        username: "testuser@example.com",
        token: "test-token",
        userId: "user123",
        timeJqlOverride: "project = TEST",
        schedulePaused: false,
        dailyHours: 8,
        save: jest.fn().mockResolvedValue(undefined),
      };

      mockJiraConfig.findOrCreate.mockResolvedValue([mockConfig as any, true]);

      await execute(mockInteraction);

      expect(mockJiraConfig.findOrCreate).toHaveBeenCalledWith({
        where: {
          guildId: "123456789",
          userId: "user123",
        },
        defaults: {
          guildId: "123456789",
          host: "https://test.atlassian.net",
          username: "testuser@example.com",
          token: "test-token",
          userId: "user123",
          timeJqlOverride: "project = TEST",
          schedulePaused: false,
          dailyHours: 8,
        },
      });
    });

    it("should handle boundary daily hours values", async () => {
      (mockInteraction.options.get as jest.Mock)
        .mockReturnValueOnce({ value: "https://test.atlassian.net" }) // host
        .mockReturnValueOnce({ value: "testuser@example.com" }) // username
        .mockReturnValueOnce({ value: "test-token" }) // token
        .mockReturnValueOnce(null) // jql
        .mockReturnValueOnce({ value: 1 }); // daily-hours (minimum)

      mockServices.IJiraService.getServerInfo.mockResolvedValue({ ok: true });

      const mockConfig = {
        guildId: "123456789",
        host: "https://test.atlassian.net",
        username: "testuser@example.com",
        token: "test-token",
        userId: "user123",
        timeJqlOverride: undefined,
        schedulePaused: false,
        dailyHours: 1,
        save: jest.fn().mockResolvedValue(undefined),
      };

      mockJiraConfig.findOrCreate.mockResolvedValue([mockConfig as any, true]);

      await execute(mockInteraction);

      expect(mockJiraConfig.findOrCreate).toHaveBeenCalledWith({
        where: {
          guildId: "123456789",
          userId: "user123",
        },
        defaults: {
          guildId: "123456789",
          host: "https://test.atlassian.net",
          username: "testuser@example.com",
          token: "test-token",
          userId: "user123",
          timeJqlOverride: undefined,
          schedulePaused: false,
          dailyHours: 1,
        },
      });
    });

    it("should update daily hours for existing config", async () => {
      (mockInteraction.options.get as jest.Mock)
        .mockReturnValueOnce({ value: "https://updated.atlassian.net" }) // host
        .mockReturnValueOnce({ value: "updated@example.com" }) // username
        .mockReturnValueOnce({ value: "updated-token" }) // token
        .mockReturnValueOnce({ value: "project = UPDATED" }) // jql
        .mockReturnValueOnce({ value: 12 }); // daily-hours

      mockServices.IJiraService.getServerInfo.mockResolvedValue({ ok: true });

      const mockConfig = {
        guildId: "123456789",
        host: "https://old.atlassian.net",
        username: "old@example.com",
        token: "old-token",
        userId: "user123",
        timeJqlOverride: "project = OLD",
        schedulePaused: false,
        dailyHours: 8,
        save: jest.fn().mockResolvedValue(undefined),
      };

      mockJiraConfig.findOrCreate.mockResolvedValue([mockConfig as any, false]);

      await execute(mockInteraction);

      // Verify the config was updated
      expect(mockConfig.host).toBe("https://updated.atlassian.net");
      expect(mockConfig.username).toBe("updated@example.com");
      expect(mockConfig.token).toBe("updated-token");
      expect(mockConfig.timeJqlOverride).toBe("project = UPDATED");
      expect(mockConfig.dailyHours).toBe(12);
      expect(mockConfig.save).toHaveBeenCalled();
    });
  });

  describe("parameter validation", () => {
    it("should extract all parameters correctly", async () => {
      const mockGetValues = [
        { value: "https://test.atlassian.net" }, // host
        { value: "testuser@example.com" }, // username
        { value: "test-token" }, // token
        { value: "project = TEST" }, // jql
        { value: 10 }, // daily-hours
      ];

      let callIndex = 0;
      (mockInteraction.options.get as jest.Mock).mockImplementation(() => {
        return mockGetValues[callIndex++] || null;
      });

      mockServices.IJiraService.getServerInfo.mockResolvedValue({ ok: true });

      const mockConfig = {
        guildId: "123456789",
        host: "https://test.atlassian.net",
        username: "testuser@example.com",
        token: "test-token",
        userId: "user123",
        timeJqlOverride: "project = TEST",
        schedulePaused: false,
        dailyHours: 10,
        save: jest.fn().mockResolvedValue(undefined),
      };

      mockJiraConfig.findOrCreate.mockResolvedValue([mockConfig as any, true]);

      await execute(mockInteraction);

      // Verify all parameters were requested correctly
      expect(mockInteraction.options.get).toHaveBeenCalledWith("host", true);
      expect(mockInteraction.options.get).toHaveBeenCalledWith(
        "username",
        true
      );
      expect(mockInteraction.options.get).toHaveBeenCalledWith("token", true);
      expect(mockInteraction.options.get).toHaveBeenCalledWith("jql", false);
      expect(mockInteraction.options.get).toHaveBeenCalledWith(
        "daily-hours",
        false
      );
    });

    it("should handle interaction deferReply", async () => {
      (mockInteraction.options.get as jest.Mock)
        .mockReturnValueOnce({ value: "https://test.atlassian.net" })
        .mockReturnValueOnce({ value: "testuser@example.com" })
        .mockReturnValueOnce({ value: "test-token" })
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null);

      mockServices.IJiraService.getServerInfo.mockResolvedValue({ ok: true });

      const mockConfig = {
        guildId: "123456789",
        host: "https://test.atlassian.net",
        username: "testuser@example.com",
        token: "test-token",
        userId: "user123",
        timeJqlOverride: undefined,
        schedulePaused: false,
        dailyHours: 8,
        save: jest.fn().mockResolvedValue(undefined),
      };

      mockJiraConfig.findOrCreate.mockResolvedValue([mockConfig as any, true]);

      await execute(mockInteraction);

      expect(mockInteraction.deferReply).toHaveBeenCalledWith({
        flags: MessageFlags.Ephemeral,
      });
    });
  });
});

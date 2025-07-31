/* eslint-disable @typescript-eslint/no-explicit-any */
import { MessageFlags } from "discord.js";
import { execute, data, name } from "../../src/commands/setup";
import { JiraConfig } from "../../src/db/models";
import { ApplicationError, ErrorType } from "../../src/services/ErrorHandler";
import { InputValidator } from "../../src/services/InputValidator";
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

// Mock InputValidator
jest.mock("../../src/services/InputValidator");

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

    // Mock InputValidator methods with dynamic responses
    (InputValidator.validateDiscordId as jest.Mock) = jest.fn();
    (InputValidator.validateJiraHost as jest.Mock) = jest
      .fn()
      .mockImplementation((host: string) => {
        // Return the host without adding https:// prefix if it's already clean
        return host;
      });
    (InputValidator.validateEmail as jest.Mock) = jest
      .fn()
      .mockImplementation((email: string) => {
        return email;
      });
    (InputValidator.validateApiToken as jest.Mock) = jest
      .fn()
      .mockImplementation((token: string) => {
        return token;
      });
    (InputValidator.validateJQL as jest.Mock) = jest
      .fn()
      .mockImplementation((jql?: string) => {
        // Return the actual JQL if provided, otherwise return undefined
        return jql;
      });
    (InputValidator.validateDailyHours as jest.Mock) = jest
      .fn()
      .mockImplementation((hours?: number) => {
        // Return the actual hours if provided, otherwise return 8 as default
        return hours ?? 8;
      });
    (InputValidator.sanitizeInput as jest.Mock) = jest
      .fn()
      .mockImplementation((input: string) => input);

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
      options: {
        get: jest.fn(),
      },
    });

    // Ensure deferReply properly updates the deferred state after jest.clearAllMocks()
    mockInteraction.deferReply.mockImplementation(() => {
      mockInteraction.deferred = true;
      return Promise.resolve(undefined);
    });
  });

  describe("when creating new configuration", () => {
    beforeEach(() => {
      (mockInteraction.options.get as jest.Mock)
        .mockReturnValueOnce({ value: "test.atlassian.net" }) // host
        .mockReturnValueOnce({ value: "testuser@example.com" }) // username
        .mockReturnValueOnce({ value: "test-token" }) // token
        .mockReturnValueOnce({ value: "project = TEST" }); // jql

      mockServices.IJiraService.getServerInfo.mockResolvedValue({ ok: true });

      const mockConfig = {
        guildId: "123456789012345678",
        host: "test.atlassian.net",
        username: "testuser@example.com",
        token: "test-token",
        userId: "987654321098765432",
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
        "test.atlassian.net",
        "testuser@example.com",
        "test-token"
      );
    });

    it("should create new configuration when successful", async () => {
      await execute(mockInteraction);

      expect(mockJiraConfig.findOrCreate).toHaveBeenCalledWith({
        where: {
          guildId: "123456789012345678",
          userId: "987654321098765432",
        },
        defaults: {
          guildId: "123456789012345678",
          host: "test.atlassian.net",
          username: "testuser@example.com",
          token: "test-token",
          userId: "987654321098765432",
          timeJqlOverride: "project = TEST",
          schedulePaused: false,
          dailyHours: 8,
        },
      });
    });

    it("should confirm successful setup", async () => {
      await execute(mockInteraction);

      expect(mockInteraction.followUp).toHaveBeenCalled();
      const followUpCall = mockInteraction.followUp.mock.calls[0][0];
      expect(followUpCall.embeds).toHaveLength(1);

      // Check embed properties using .data pattern like in hours test
      const embed = followUpCall.embeds[0];
      const embedData = embed.data || embed;
      expect(embedData.title).toBe("✅ Configuration Saved Successfully!");
      expect(embedData.description).toBe(
        "Your Jira configuration has been saved and tested successfully."
      );
      expect(followUpCall.flags).toBe(MessageFlags.Ephemeral);
    });
  });

  describe("when updating existing configuration", () => {
    beforeEach(() => {
      (mockInteraction.options.get as jest.Mock)
        .mockReturnValueOnce({ value: "updated.atlassian.net" }) // host
        .mockReturnValueOnce({ value: "updated@example.com" }) // username
        .mockReturnValueOnce({ value: "updated-token" }) // token
        .mockReturnValueOnce({ value: "project = UPDATED" }); // jql

      mockServices.IJiraService.getServerInfo.mockResolvedValue({ ok: true });

      const mockConfig = {
        guildId: "123456789012345678",
        host: "https://old.atlassian.net",
        username: "old@example.com",
        token: "old-token",
        userId: "987654321098765432",
        timeJqlOverride: "project = OLD",
        schedulePaused: false,
        save: jest.fn().mockResolvedValue(undefined),
      };

      mockJiraConfig.findOrCreate.mockResolvedValue([mockConfig as any, false]);
    });

    it("should update existing configuration", async () => {
      await execute(mockInteraction);

      const [config] = await mockJiraConfig.findOrCreate.mock.results[0].value;
      expect(config.host).toBe("updated.atlassian.net");
      expect(config.username).toBe("updated@example.com");
      expect(config.token).toBe("updated-token");
      expect(config.timeJqlOverride).toBe("project = UPDATED");
      expect(config.save).toHaveBeenCalled();
    });

    it("should confirm successful update", async () => {
      await execute(mockInteraction);

      expect(mockInteraction.followUp).toHaveBeenCalled();
      const followUpCall = mockInteraction.followUp.mock.calls[0][0];
      expect(followUpCall.embeds).toHaveLength(1);

      // Check embed properties using .data pattern like in hours test
      const embed = followUpCall.embeds[0];
      const embedData = embed.data || embed;
      expect(embedData.title).toBe("✅ Configuration Saved Successfully!");
      expect(embedData.description).toBe(
        "Your Jira configuration has been saved and tested successfully."
      );
      expect(followUpCall.flags).toBe(MessageFlags.Ephemeral);
    });
  });

  describe("when setup without JQL override", () => {
    beforeEach(() => {
      (mockInteraction.options.get as jest.Mock)
        .mockReturnValueOnce({ value: "test.atlassian.net" }) // host
        .mockReturnValueOnce({ value: "testuser@example.com" }) // username
        .mockReturnValueOnce({ value: "test-token" }) // token
        .mockReturnValueOnce(null); // jql (optional)

      mockServices.IJiraService.getServerInfo.mockResolvedValue({ ok: true });

      const mockConfig = {
        guildId: "123456789012345678",
        host: "test.atlassian.net",
        username: "testuser@example.com",
        token: "test-token",
        userId: "987654321098765432",
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
          guildId: "123456789012345678",
          userId: "987654321098765432",
        },
        defaults: {
          guildId: "123456789012345678",
          host: "test.atlassian.net",
          username: "testuser@example.com",
          token: "test-token",
          userId: "987654321098765432",
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
      mockServices.IJiraService.getServerInfo.mockRejectedValue(
        new ApplicationError(
          "Invalid credentials (getting server info)",
          ErrorType.AUTHENTICATION_ERROR,
          true,
          401
        )
      );

      await execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content:
            "❌ **Authentication Failed**: Your Jira credentials appear to be invalid. Please run `/setup` to reconfigure your connection.",
        })
      );

      expect(mockJiraConfig.findOrCreate).not.toHaveBeenCalled();
    });

    it("should handle Jira connection failure with different error messages", async () => {
      mockServices.IJiraService.getServerInfo.mockRejectedValue(
        new ApplicationError(
          "Resource not found (getting server info)",
          ErrorType.JIRA_API_ERROR,
          true,
          404
        )
      );

      await execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content:
            "❌ **Jira Error**: Resource not found (getting server info)\n\nPlease check your Jira configuration with `/info` and verify your credentials.",
        })
      );
    });

    it("should handle service container errors", async () => {
      // Override the successful mock set up in beforeEach
      (ServiceContainer.getInstance as jest.Mock).mockImplementation(() => {
        throw new Error("Service container not initialized");
      });

      await expect(execute(mockInteraction)).resolves.not.toThrow();

      // Verify that an error response was sent to the user
      // Since ServiceContainer fails before deferReply, it should use reply() not editReply()
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringMatching(
            /^❌ \*\*Unexpected Error\*\*.*Error ID:/s
          ),
          flags: expect.any(Number),
        })
      );
    });

    it("should handle database errors", async () => {
      mockServices.IJiraService.getServerInfo.mockResolvedValue({
        version: "8.5.0",
      });
      mockJiraConfig.findOrCreate.mockRejectedValue(
        new Error("Database error")
      );

      await expect(execute(mockInteraction)).resolves.not.toThrow();

      // Verify that an error response was sent to the user
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringMatching(
            /^❌ \*\*Unexpected Error\*\*.*Error ID:/s
          ),
        })
      );
    });

    it("should handle save errors when updating configuration", async () => {
      mockServices.IJiraService.getServerInfo.mockResolvedValue({
        version: "8.5.0",
      });

      const mockConfig = {
        guildId: "123456789012345678",
        host: "https://old.atlassian.net",
        username: "old@example.com",
        token: "old-token",
        userId: "987654321098765432",
        timeJqlOverride: null,
        schedulePaused: false,
        save: jest.fn().mockRejectedValue(new Error("Save failed")),
      };

      mockJiraConfig.findOrCreate.mockResolvedValue([mockConfig as any, false]);

      await expect(execute(mockInteraction)).resolves.not.toThrow();

      // Verify that an error response was sent to the user
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringMatching(
            /^❌ \*\*Unexpected Error\*\*.*Error ID:/s
          ),
        })
      );
    });

    it("should handle missing guildId", async () => {
      // Test edge case where guildId might be null
      mockInteraction.guildId = null;

      mockServices.IJiraService.getServerInfo.mockResolvedValue({
        version: "8.5.0",
      });

      // This should be handled gracefully with error handling
      await expect(execute(mockInteraction)).resolves.not.toThrow();

      // Verify that an error response was sent to the user
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringMatching(
            /^❌ \*\*Unexpected Error\*\*.*Error ID:/s
          ),
        })
      );
    });
  });

  describe("when setting daily hours", () => {
    it("should save custom daily hours when provided", async () => {
      (mockInteraction.options.get as jest.Mock)
        .mockReturnValueOnce({ value: "test.atlassian.net" }) // host
        .mockReturnValueOnce({ value: "testuser@example.com" }) // username
        .mockReturnValueOnce({ value: "test-token" }) // token
        .mockReturnValueOnce({ value: "project = TEST" }) // jql
        .mockReturnValueOnce({ value: 6 }); // daily-hours

      mockServices.IJiraService.getServerInfo.mockResolvedValue({ ok: true });

      const mockConfig = {
        guildId: "123456789012345678",
        host: "test.atlassian.net",
        username: "testuser@example.com",
        token: "test-token",
        userId: "987654321098765432",
        timeJqlOverride: "project = TEST",
        schedulePaused: false,
        dailyHours: 6,
        save: jest.fn().mockResolvedValue(undefined),
      };

      mockJiraConfig.findOrCreate.mockResolvedValue([mockConfig as any, true]);

      await execute(mockInteraction);

      expect(mockJiraConfig.findOrCreate).toHaveBeenCalledWith({
        where: {
          guildId: "123456789012345678",
          userId: "987654321098765432",
        },
        defaults: {
          guildId: "123456789012345678",
          host: "test.atlassian.net",
          username: "testuser@example.com",
          token: "test-token",
          userId: "987654321098765432",
          timeJqlOverride: "project = TEST",
          schedulePaused: false,
          dailyHours: 6,
        },
      });
    });

    it("should default to 8 hours when daily-hours not provided", async () => {
      (mockInteraction.options.get as jest.Mock)
        .mockReturnValueOnce({ value: "test.atlassian.net" }) // host
        .mockReturnValueOnce({ value: "testuser@example.com" }) // username
        .mockReturnValueOnce({ value: "test-token" }) // token
        .mockReturnValueOnce({ value: "project = TEST" }) // jql
        .mockReturnValueOnce(null); // daily-hours (not provided)

      mockServices.IJiraService.getServerInfo.mockResolvedValue({ ok: true });

      const mockConfig = {
        guildId: "123456789012345678",
        host: "test.atlassian.net",
        username: "testuser@example.com",
        token: "test-token",
        userId: "987654321098765432",
        timeJqlOverride: "project = TEST",
        schedulePaused: false,
        dailyHours: 8,
        save: jest.fn().mockResolvedValue(undefined),
      };

      mockJiraConfig.findOrCreate.mockResolvedValue([mockConfig as any, true]);

      await execute(mockInteraction);

      expect(mockJiraConfig.findOrCreate).toHaveBeenCalledWith({
        where: {
          guildId: "123456789012345678",
          userId: "987654321098765432",
        },
        defaults: {
          guildId: "123456789012345678",
          host: "test.atlassian.net",
          username: "testuser@example.com",
          token: "test-token",
          userId: "987654321098765432",
          timeJqlOverride: "project = TEST",
          schedulePaused: false,
          dailyHours: 8,
        },
      });
    });

    it("should handle boundary daily hours values", async () => {
      (mockInteraction.options.get as jest.Mock)
        .mockReturnValueOnce({ value: "test.atlassian.net" }) // host
        .mockReturnValueOnce({ value: "testuser@example.com" }) // username
        .mockReturnValueOnce({ value: "test-token" }) // token
        .mockReturnValueOnce(null) // jql
        .mockReturnValueOnce({ value: 1 }); // daily-hours (minimum)

      mockServices.IJiraService.getServerInfo.mockResolvedValue({ ok: true });

      const mockConfig = {
        guildId: "123456789012345678",
        host: "test.atlassian.net",
        username: "testuser@example.com",
        token: "test-token",
        userId: "987654321098765432",
        timeJqlOverride: undefined,
        schedulePaused: false,
        dailyHours: 1,
        save: jest.fn().mockResolvedValue(undefined),
      };

      mockJiraConfig.findOrCreate.mockResolvedValue([mockConfig as any, true]);

      await execute(mockInteraction);

      expect(mockJiraConfig.findOrCreate).toHaveBeenCalledWith({
        where: {
          guildId: "123456789012345678",
          userId: "987654321098765432",
        },
        defaults: {
          guildId: "123456789012345678",
          host: "test.atlassian.net",
          username: "testuser@example.com",
          token: "test-token",
          userId: "987654321098765432",
          timeJqlOverride: undefined,
          schedulePaused: false,
          dailyHours: 1,
        },
      });
    });

    it("should update daily hours for existing config", async () => {
      (mockInteraction.options.get as jest.Mock)
        .mockReturnValueOnce({ value: "updated.atlassian.net" }) // host
        .mockReturnValueOnce({ value: "updated@example.com" }) // username
        .mockReturnValueOnce({ value: "updated-token" }) // token
        .mockReturnValueOnce({ value: "project = UPDATED" }) // jql
        .mockReturnValueOnce({ value: 12 }); // daily-hours

      mockServices.IJiraService.getServerInfo.mockResolvedValue({ ok: true });

      const mockConfig = {
        guildId: "123456789012345678",
        host: "https://old.atlassian.net",
        username: "old@example.com",
        token: "old-token",
        userId: "987654321098765432",
        timeJqlOverride: "project = OLD",
        schedulePaused: false,
        dailyHours: 8,
        save: jest.fn().mockResolvedValue(undefined),
      };

      mockJiraConfig.findOrCreate.mockResolvedValue([mockConfig as any, false]);

      await execute(mockInteraction);

      // Verify the config was updated
      expect(mockConfig.host).toBe("updated.atlassian.net");
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
        { value: "test.atlassian.net" }, // host
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
        guildId: "123456789012345678",
        host: "test.atlassian.net",
        username: "testuser@example.com",
        token: "test-token",
        userId: "987654321098765432",
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
        .mockReturnValueOnce({ value: "test.atlassian.net" })
        .mockReturnValueOnce({ value: "testuser@example.com" })
        .mockReturnValueOnce({ value: "test-token" })
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null);

      mockServices.IJiraService.getServerInfo.mockResolvedValue({ ok: true });

      const mockConfig = {
        guildId: "123456789012345678",
        host: "test.atlassian.net",
        username: "testuser@example.com",
        token: "test-token",
        userId: "987654321098765432",
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

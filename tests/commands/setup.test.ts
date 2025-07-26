/* eslint-disable @typescript-eslint/no-explicit-any */
import { MessageFlags } from "discord.js";
import { execute } from "../../src/commands/setup";
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

describe("Setup Command", () => {
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

      mockServices.JiraService.getServerInfo.mockResolvedValue({ ok: true });

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

      expect(mockServices.JiraService.getServerInfo).toHaveBeenCalledWith(
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

      mockServices.JiraService.getServerInfo.mockResolvedValue({ ok: true });

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

      mockServices.JiraService.getServerInfo.mockResolvedValue({ ok: true });

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
      mockServices.JiraService.getServerInfo.mockResolvedValue({
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
      mockServices.JiraService.getServerInfo.mockResolvedValue({ ok: true });
      mockJiraConfig.findOrCreate.mockRejectedValue(
        new Error("Database error")
      );

      await expect(execute(mockInteraction)).rejects.toThrow("Database error");
    });

    it("should handle save errors when updating configuration", async () => {
      mockServices.JiraService.getServerInfo.mockResolvedValue({ ok: true });

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
  });
});

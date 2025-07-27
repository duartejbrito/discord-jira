/* eslint-disable @typescript-eslint/no-explicit-any */
import { MessageFlags } from "discord.js";
import { execute } from "../../src/commands/time";
import { JiraConfig } from "../../src/db/models";
import { ServiceContainer } from "../../src/services/ServiceContainer";
import {
  createMockInteraction,
  createMockServiceContainer,
} from "../test-utils";

// Mock Discord.js components
jest.mock("discord.js", () => ({
  ...jest.requireActual("discord.js"),
  EmbedBuilder: jest.fn().mockImplementation(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
  })),
  ActionRowBuilder: jest.fn().mockImplementation(() => ({
    addComponents: jest.fn().mockReturnThis(),
  })),
  ButtonBuilder: jest.fn().mockImplementation(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setLabel: jest.fn().mockReturnThis(),
    setStyle: jest.fn().mockReturnThis(),
  })),
  ButtonStyle: {
    Success: 3,
  },
  MessageFlags: {
    Ephemeral: 64,
  },
}));

// Mock the database model
jest.mock("../../src/db/models");
const mockJiraConfig = JiraConfig as jest.Mocked<typeof JiraConfig>;

// Mock the ServiceContainer
jest.mock("../../src/services/ServiceContainer");

// Mock utils
jest.mock("../../src/services/utils", () => ({
  convertSeconds: jest.fn(
    (seconds: number) =>
      `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  ),
  distributeTime: jest.fn((total: number, count: number, method: string) =>
    new Array(count).fill(Math.floor(total / count))
  ),
}));

describe("Time Command", () => {
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

    // Create mock interaction with specific methods for time command
    mockInteraction = createMockInteraction({
      guildId: "123456789",
      user: { id: "user123" },
      editReply: jest.fn().mockResolvedValue({
        createMessageComponentCollector: jest.fn().mockReturnValue({
          on: jest.fn(),
        }),
      }),
      replied: false,
      deferred: true,
      options: {
        get: jest.fn(),
      },
    });
  });

  describe("when user has no configuration", () => {
    beforeEach(() => {
      // Mock the current date to be Tuesday, July 29, 2025
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2025-07-29T10:00:00.000Z"));

      (mockInteraction.options.get as jest.Mock)
        .mockReturnValueOnce({ value: 1 }) // days-ago
        .mockReturnValueOnce(null); // hours (optional)

      mockJiraConfig.findOne.mockResolvedValue(null);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should defer reply on start", async () => {
      await execute(mockInteraction);

      expect(mockInteraction.deferReply).toHaveBeenCalledWith({
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should inform user that configuration is needed", async () => {
      await execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: "You need to setup your Jira configuration first.",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should query database with correct parameters", async () => {
      await execute(mockInteraction);

      expect(mockJiraConfig.findOne).toHaveBeenCalledWith({
        where: { guildId: "123456789", userId: "user123" },
      });
    });
  });

  describe("when checking weekend", () => {
    beforeEach(() => {
      // Mock the current date to be Sunday, July 27, 2025
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2025-07-27T10:00:00.000Z"));

      (mockInteraction.options.get as jest.Mock)
        .mockReturnValueOnce({ value: 1 }) // days-ago
        .mockReturnValueOnce({ value: 8 }); // hours
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should reject weekend work checking", async () => {
      await execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: "You can't check your work on weekends.",
        flags: MessageFlags.Ephemeral,
      });
    });
  });

  describe("when user has configuration and valid workday", () => {
    const mockConfig = {
      guildId: "123456789",
      userId: "user123",
      host: "https://test.atlassian.net",
      username: "testuser@example.com",
      token: "test-token",
      timeJqlOverride: null,
    };

    beforeEach(() => {
      // Mock the current date to be Tuesday, July 29, 2025
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2025-07-29T10:00:00.000Z"));

      (mockInteraction.options.get as jest.Mock)
        .mockReturnValueOnce({ value: 1 }) // days-ago
        .mockReturnValueOnce({ value: 8 }); // hours

      mockJiraConfig.findOne.mockResolvedValue(mockConfig as any);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should show progress message", async () => {
      mockServices.IJiraService.getIssuesWorked.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ total: 0, issues: [] }),
      });

      await execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("Checking your work for"),
          flags: MessageFlags.Ephemeral,
        })
      );
    });

    it("should use default JQL when no override", async () => {
      mockServices.IJiraService.getIssuesWorked.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ total: 0, issues: [] }),
      });

      await execute(mockInteraction);

      expect(mockServices.IJiraService.getIssuesWorked).toHaveBeenCalledWith(
        "https://test.atlassian.net",
        "testuser@example.com",
        "test-token",
        expect.stringContaining("assignee WAS currentUser()")
      );
    });

    it("should use JQL override when provided", async () => {
      const configWithJql = {
        ...mockConfig,
        timeJqlOverride: "project = TEST AND assignee = currentUser()",
      };
      mockJiraConfig.findOne.mockResolvedValue(configWithJql as any);

      mockServices.IJiraService.getIssuesWorked.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ total: 0, issues: [] }),
      });

      await execute(mockInteraction);

      expect(mockServices.IJiraService.getIssuesWorked).toHaveBeenCalledWith(
        "https://test.atlassian.net",
        "testuser@example.com",
        "test-token",
        expect.stringContaining("project = TEST AND assignee = currentUser()")
      );
    });

    it("should handle no issues found", async () => {
      mockServices.IJiraService.getIssuesWorked.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ total: 0, issues: [] }),
      });

      await execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("You didn't work on any issues for"),
          flags: MessageFlags.Ephemeral,
        })
      );
    });

    it("should display issues with existing worklogs", async () => {
      const mockIssues = [
        {
          id: "10001",
          key: "TEST-1",
          fields: {
            summary: "Test issue 1",
            assignee: { displayName: "Test User" },
          },
        },
      ];

      const mockWorklogs = {
        worklogs: [
          {
            author: { emailAddress: "testuser@example.com" },
            timeSpent: "2h",
            timeSpentSeconds: 7200,
          },
        ],
      };

      mockServices.IJiraService.getIssuesWorked.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ total: 1, issues: mockIssues }),
      });

      mockServices.IJiraService.getIssueWorklog.mockResolvedValue({
        json: jest.fn().mockResolvedValue(mockWorklogs),
      });

      await execute(mockInteraction);

      expect(mockServices.IJiraService.getIssueWorklog).toHaveBeenCalledWith(
        "https://test.atlassian.net",
        "testuser@example.com",
        "test-token",
        "TEST-1",
        new Date("2025-07-28T10:00:00.000Z")
      );

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([expect.any(Object)]),
          components: [],
        })
      );
    });

    it("should display issues without worklogs and show submit button", async () => {
      const mockIssues = [
        {
          id: "10001",
          key: "TEST-1",
          fields: {
            summary: "Test issue 1",
            assignee: { displayName: "Test User" },
          },
        },
      ];

      const mockWorklogs = {
        worklogs: [],
      };

      mockServices.IJiraService.getIssuesWorked.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ total: 1, issues: mockIssues }),
      });

      mockServices.IJiraService.getIssueWorklog.mockResolvedValue({
        json: jest.fn().mockResolvedValue(mockWorklogs),
      });

      await execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([expect.any(Object)]),
          components: expect.arrayContaining([expect.any(Object)]),
        })
      );
    });
  });

  describe("error handling", () => {
    const mockConfig = {
      guildId: "123456789",
      userId: "user123",
      host: "https://test.atlassian.net",
      username: "testuser@example.com",
      token: "test-token",
      timeJqlOverride: null,
    };

    beforeEach(() => {
      // Mock the current date to be Tuesday, July 29, 2025
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2025-07-29T10:00:00.000Z"));

      (mockInteraction.options.get as jest.Mock)
        .mockReturnValueOnce({ value: 1 }) // days-ago
        .mockReturnValueOnce({ value: 8 }); // hours

      mockJiraConfig.findOne.mockResolvedValue(mockConfig as any);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should handle Jira API errors", async () => {
      mockServices.IJiraService.getIssuesWorked.mockResolvedValue({
        ok: false,
        statusText: "Unauthorized",
      });

      await execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: "Failed to get your work: Unauthorized",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should handle service container errors", async () => {
      (ServiceContainer.getInstance as jest.Mock).mockImplementation(() => {
        throw new Error("Service container not initialized");
      });

      await expect(execute(mockInteraction)).rejects.toThrow(
        "Service container not initialized"
      );
    });

    it("should handle database errors", async () => {
      mockJiraConfig.findOne.mockRejectedValue(new Error("Database error"));

      await expect(execute(mockInteraction)).rejects.toThrow("Database error");
    });
  });

  describe("worklog submission", () => {
    const mockConfig = {
      guildId: "123456789",
      userId: "user123",
      host: "https://test.atlassian.net",
      username: "testuser@example.com",
      token: "test-token",
      timeJqlOverride: null,
    };

    beforeEach(() => {
      // Mock the current date to be Tuesday, July 29, 2025
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2025-07-29T10:00:00.000Z"));

      (mockInteraction.options.get as jest.Mock)
        .mockReturnValueOnce({ value: 1 }) // days-ago
        .mockReturnValueOnce({ value: 8 }); // hours

      mockJiraConfig.findOne.mockResolvedValue(mockConfig as any);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should setup message component collector for worklog submission", async () => {
      const mockIssues = [
        {
          id: "10001",
          key: "TEST-1",
          fields: {
            summary: "Test issue 1",
            assignee: { displayName: "Test User" },
          },
        },
      ];

      const mockWorklogs = { worklogs: [] };

      mockServices.IJiraService.getIssuesWorked.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ total: 1, issues: mockIssues }),
      });

      mockServices.IJiraService.getIssueWorklog.mockResolvedValue({
        json: jest.fn().mockResolvedValue(mockWorklogs),
      });

      const mockCollector = {
        on: jest.fn(),
      };

      const mockMessage = {
        createMessageComponentCollector: jest
          .fn()
          .mockReturnValue(mockCollector),
      };

      (mockInteraction.editReply as jest.Mock).mockResolvedValue(mockMessage);

      await execute(mockInteraction);

      expect(mockMessage.createMessageComponentCollector).toHaveBeenCalledWith({
        filter: expect.any(Function),
        time: 15000,
      });

      expect(mockCollector.on).toHaveBeenCalledWith(
        "collect",
        expect.any(Function)
      );
      expect(mockCollector.on).toHaveBeenCalledWith(
        "end",
        expect.any(Function)
      );
    });
  });
});

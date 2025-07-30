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
  distributeTime: jest.fn((total: number, count: number) =>
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
      guildId: "123456789012345678",
      user: { id: "987654321098765432" },
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
        where: { guildId: "123456789012345678", userId: "987654321098765432" },
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

      // Provide a valid config so weekend check can happen
      const mockConfig = {
        guildId: "123456789012345678",
        userId: "987654321098765432",
        host: "https://test.atlassian.net",
        username: "testuser@example.com",
        token: "token123",
        timeJqlOverride: null,
        dailyHours: 8,
      };
      mockJiraConfig.findOne.mockResolvedValue(mockConfig as any);
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
      guildId: "123456789012345678",
      userId: "987654321098765432",
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
      guildId: "123456789012345678",
      userId: "987654321098765432",
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

      await expect(execute(mockInteraction)).resolves.not.toThrow();

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringMatching(
            /^❌ \*\*Unexpected Error\*\*.*Error ID:/s
          ),
        })
      );
    });

    it("should handle database errors", async () => {
      mockJiraConfig.findOne.mockRejectedValue(new Error("Database error"));

      await expect(execute(mockInteraction)).resolves.not.toThrow();

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringMatching(
            /^❌ \*\*Unexpected Error\*\*.*Error ID:/s
          ),
        })
      );
    });
  });

  describe("worklog submission", () => {
    const mockConfig = {
      guildId: "123456789012345678",
      userId: "987654321098765432",
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

      // Test the filter function
      const collectorCall =
        mockMessage.createMessageComponentCollector.mock.calls[0][0];
      const filterFunction = collectorCall.filter;

      // Test that filter returns true for same user
      const mockSameUserInteraction = { user: { id: "987654321098765432" } };
      expect(filterFunction(mockSameUserInteraction)).toBe(true);

      // Test that filter returns false for different user
      const mockDifferentUserInteraction = { user: { id: "user-456" } };
      expect(filterFunction(mockDifferentUserInteraction)).toBe(false);

      expect(mockCollector.on).toHaveBeenCalledWith(
        "collect",
        expect.any(Function)
      );
      expect(mockCollector.on).toHaveBeenCalledWith(
        "end",
        expect.any(Function)
      );
    });

    it("should handle collector timeout with no interactions", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          total: 0,
          issues: [],
        }),
      };

      mockServices.IJiraService.getIssuesWorked.mockResolvedValue(mockResponse);

      await execute(mockInteraction);

      // When no issues are found, it should reply with "didn't work on any issues"
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining("didn't work on any issues"),
        flags: MessageFlags.Ephemeral,
      });
    });
  });

  describe("replyOrFollowUp helper function", () => {
    it("should use followUp when interaction has already replied", async () => {
      // Set the date to ensure we don't hit weekend logic
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2025-07-30T10:00:00.000Z")); // Wednesday

      const mockResponse = {
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      };

      // Mock the options that time command expects
      (mockInteraction.options.get as jest.Mock)
        .mockReturnValueOnce({ value: 1 }) // days-ago (Tuesday, not weekend)
        .mockReturnValueOnce(null); // hours (optional)

      // Mock findOne to return config so we don't hit config error
      mockJiraConfig.findOne.mockResolvedValue({
        host: "https://test.atlassian.net",
        username: "test@example.com",
        token: "test-token",
        jql: "assignee = currentUser()",
      } as any);

      mockServices.IJiraService.getIssuesWorked.mockResolvedValue(mockResponse);

      // Set interaction as already replied
      mockInteraction.replied = true;
      mockInteraction.deferred = false;

      await execute(mockInteraction);

      // Should use followUp instead of editReply since interaction already replied
      expect(mockInteraction.followUp).toHaveBeenCalledWith({
        content: expect.stringContaining("Failed to get your work"),
        flags: MessageFlags.Ephemeral,
      });

      jest.useRealTimers();
    });

    it("should use reply when interaction is not deferred and not replied", async () => {
      // Set the date to ensure we don't hit weekend logic
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2025-07-30T10:00:00.000Z")); // Wednesday

      const mockResponse = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      };

      // Mock the options that time command expects
      (mockInteraction.options.get as jest.Mock)
        .mockReturnValueOnce({ value: 1 }) // days-ago (Tuesday, not weekend)
        .mockReturnValueOnce(null); // hours (optional)

      // Mock findOne to return config so we don't hit config error
      mockJiraConfig.findOne.mockResolvedValue({
        host: "https://test.atlassian.net",
        username: "test@example.com",
        token: "test-token",
        jql: "assignee = currentUser()",
      } as any);

      mockServices.IJiraService.getIssuesWorked.mockResolvedValue(mockResponse);

      // Set interaction as not replied and not deferred
      mockInteraction.replied = false;
      mockInteraction.deferred = false;

      await execute(mockInteraction);

      // Should use reply directly since not deferred and not replied
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining("Failed to get your work"),
        flags: MessageFlags.Ephemeral,
      });

      jest.useRealTimers();
    });
  });

  describe("message collector functionality", () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2025-07-30T10:00:00.000Z")); // Wednesday

      (mockInteraction.options.get as jest.Mock)
        .mockReturnValueOnce({ value: 1 }) // days-ago (Tuesday, not weekend)
        .mockReturnValueOnce({ value: 8 }); // hours

      // Mock findOne to return config
      mockJiraConfig.findOne.mockResolvedValue({
        host: "https://test.atlassian.net",
        username: "test@example.com",
        token: "test-token",
        jql: "assignee = currentUser()",
      } as any);

      // Mock successful API response with issues
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          total: 2,
          issues: [
            {
              id: "ISSUE-1",
              key: "ISSUE-1",
              fields: {
                summary: "Test Issue 1",
                assignee: { displayName: "Test User" },
              },
              worklogs: [],
            },
            {
              id: "ISSUE-2",
              key: "ISSUE-2",
              fields: {
                summary: "Test Issue 2",
                assignee: { displayName: "Test User" },
              },
              worklogs: [],
            },
          ],
        }),
      };

      mockServices.IJiraService.getIssuesWorked.mockResolvedValue(mockResponse);
      mockServices.IJiraService.getIssueWorklog.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ worklogs: [] }),
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should handle submit button click in collector", async () => {
      const mockCollector = {
        on: jest.fn(),
      };

      // Mock the message and collector
      const mockMessage = {
        createMessageComponentCollector: jest
          .fn()
          .mockReturnValue(mockCollector),
      };

      mockInteraction.editReply.mockResolvedValue(mockMessage);
      mockServices.IJiraService.postWorklog.mockResolvedValue({ ok: true });

      await execute(mockInteraction);

      // Get the collector event handlers
      const onCollectHandler = mockCollector.on.mock.calls.find(
        (call) => call[0] === "collect"
      )[1];

      // Mock interaction for submit button
      const mockButtonInteraction = {
        customId: "submit",
        user: { id: "987654321098765432" },
        update: jest.fn().mockResolvedValue({}),
      };

      // Test submit button functionality (covers lines 243-257)
      await onCollectHandler(mockButtonInteraction);

      expect(mockServices.IJiraService.postWorklog).toHaveBeenCalledTimes(2);
      expect(mockButtonInteraction.update).toHaveBeenCalledWith({
        content: "Time logged successfully.",
        embeds: expect.any(Array),
        components: [],
      });
    });

    it("should handle collector end with no collected interactions", async () => {
      const mockCollector = {
        on: jest.fn(),
      };

      // Mock the message and collector
      const mockMessage = {
        createMessageComponentCollector: jest
          .fn()
          .mockReturnValue(mockCollector),
      };

      mockInteraction.editReply.mockResolvedValue(mockMessage);

      await execute(mockInteraction);

      // Get the collector event handlers
      const onEndHandler = mockCollector.on.mock.calls.find(
        (call) => call[0] === "end"
      )[1];

      // Mock collected interactions (empty)
      const mockCollected = { size: 0 };

      // Test collector end with no interactions (covers lines 266-267, 236)
      await onEndHandler(mockCollected);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        embeds: expect.any(Array),
        components: [],
      });
    });

    it("should handle collector end with collected interactions", async () => {
      const mockCollector = {
        on: jest.fn(),
      };

      // Mock the message and collector
      const mockMessage = {
        createMessageComponentCollector: jest
          .fn()
          .mockReturnValue(mockCollector),
      };

      mockInteraction.editReply.mockResolvedValue(mockMessage);

      await execute(mockInteraction);

      // Get the collector event handlers
      const onEndHandler = mockCollector.on.mock.calls.find(
        (call) => call[0] === "end"
      )[1];

      // Mock collected interactions (not empty)
      const mockCollected = { size: 1 };

      // Test collector end with collected interactions (covers the else branch)
      await onEndHandler(mockCollected);

      // Should not call editReply when there are collected interactions
      expect(mockInteraction.editReply).not.toHaveBeenCalledWith({
        embeds: expect.any(Array),
        components: [],
      });
    });
  });
});

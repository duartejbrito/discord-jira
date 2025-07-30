import { EmbedBuilder } from "discord.js";
import * as schedule from "node-schedule";
import { client } from "../../src";
import { JiraConfig } from "../../src/db/models";
import { initScheduledJobs, tz, dailyRule, daysAgo } from "../../src/scheduler";
import { ServiceContainer } from "../../src/services/ServiceContainer";
import { createMockServiceContainer } from "../test-utils";

// Mock dependencies
jest.mock("node-schedule", () => ({
  scheduleJob: jest.fn(),
}));
jest.mock("../../src/db/models");
jest.mock("../../src/services/ServiceContainer");
jest.mock("../../src", () => ({
  client: {
    guilds: {
      cache: {
        get: jest.fn(),
      },
    },
  },
}));
jest.mock("discord.js", () => ({
  EmbedBuilder: jest.fn(),
}));

const mockSchedule = schedule as jest.Mocked<typeof schedule>;

describe("Scheduler", () => {
  let scheduledJobCallback: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Capture the scheduled job callback - node-schedule has overloaded signatures
    mockSchedule.scheduleJob.mockImplementation((...args: unknown[]) => {
      if (args.length === 3) {
        scheduledJobCallback = args[2] as jest.Mock;
      }
      return {} as schedule.Job;
    });
  });

  it("should export correct constants", () => {
    expect(tz).toBe("Etc/UTC");
    expect(dailyRule).toBe("0 6 * * 2-6");
    expect(daysAgo).toBe("1");
  });

  it("should initialize scheduled jobs", () => {
    initScheduledJobs();

    expect(mockSchedule.scheduleJob).toHaveBeenCalledWith(
      "daily-job",
      { rule: dailyRule, tz },
      expect.any(Function)
    );
  });

  it("should call schedule.scheduleJob with correct parameters", () => {
    initScheduledJobs();

    expect(mockSchedule.scheduleJob).toHaveBeenCalledTimes(1);
    expect(mockSchedule.scheduleJob).toHaveBeenCalledWith(
      "daily-job",
      { rule: "0 6 * * 2-6", tz: "Etc/UTC" },
      expect.any(Function)
    );
  });

  it("should handle scheduler initialization without errors", () => {
    expect(() => initScheduledJobs()).not.toThrow();
  });

  describe("Scheduled Job Logic", () => {
    let mockContainer: unknown;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockServices: any;

    beforeEach(() => {
      // Use test utilities for consistent mock setup
      const containerSetup = createMockServiceContainer();
      mockContainer = containerSetup.mockContainer;
      mockServices = containerSetup.mockServices;

      // Mock the ServiceContainer.getInstance method
      (ServiceContainer as unknown as { getInstance: jest.Mock }).getInstance =
        jest.fn().mockReturnValue(mockContainer);

      // Mock JiraConfig.findAll
      (JiraConfig as unknown as { findAll: jest.Mock }).findAll = jest.fn();

      // Mock Discord client
      const mockUser = {
        send: jest.fn(),
      };
      const mockMember = {
        fetch: jest.fn().mockResolvedValue(mockUser),
      };
      const mockGuild = {
        members: mockMember,
      };
      (client as unknown as { guilds: { cache: { get: jest.Mock } } }).guilds =
        {
          cache: {
            get: jest.fn().mockReturnValue(mockGuild),
          },
        };

      // Mock EmbedBuilder
      const mockEmbed = {
        setTitle: jest.fn().mockReturnThis(),
        setColor: jest.fn().mockReturnThis(),
        addFields: jest.fn().mockReturnThis(),
        setFooter: jest.fn().mockReturnThis(),
      };
      (EmbedBuilder as unknown as jest.Mock).mockImplementation(
        () => mockEmbed
      );
    });

    it("should handle configs with schedulePaused false", async () => {
      const mockConfigs = [
        {
          userId: "987654321098765432",
          guildId: "123456789012345678",
          host: "test.jira.com",
          username: "test@example.com",
          token: "validtoken123456",
          schedulePaused: false,
          timeJqlOverride: null,
        },
      ];

      (
        JiraConfig as unknown as { findAll: jest.Mock }
      ).findAll.mockResolvedValue(mockConfigs);

      const mockSearchResults = {
        total: 0,
        issues: [],
      };

      mockServices.IJiraService.getIssuesWorked.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockSearchResults),
      });

      initScheduledJobs();
      await scheduledJobCallback();

      expect(JiraConfig.findAll).toHaveBeenCalledWith({
        where: { schedulePaused: false },
      });
      expect(mockServices.IJiraService.getIssuesWorked).toHaveBeenCalledWith(
        "test.jira.com",
        "test@example.com",
        "validtoken123456",
        // eslint-disable-next-line quotes
        'assignee WAS currentUser() ON -1d AND status WAS "In Progress" ON -1d'
      );
    });

    it("should handle custom JQL override", async () => {
      const mockConfigs = [
        {
          userId: "987654321098765432",
          guildId: "123456789012345678",
          host: "test.jira.com",
          username: "test@example.com",
          token: "validtoken123456",
          schedulePaused: false,
          timeJqlOverride: {
            format: jest
              .fn()
              .mockReturnValue(
                "assignee = currentUser() AND status = 'In Progress'"
              ),
          },
        },
      ];

      (
        JiraConfig as unknown as { findAll: jest.Mock }
      ).findAll.mockResolvedValue(mockConfigs);

      const mockSearchResults = {
        total: 0,
        issues: [],
      };

      mockServices.IJiraService.getIssuesWorked.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockSearchResults),
      });

      initScheduledJobs();
      await scheduledJobCallback();

      expect(mockServices.IJiraService.getIssuesWorked).toHaveBeenCalledWith(
        "test.jira.com",
        "test@example.com",
        "validtoken123456",
        "assignee = currentUser() AND status = 'In Progress'"
      );
    });

    it("should handle failed API response", async () => {
      const mockConfigs = [
        {
          userId: "987654321098765432",
          guildId: "123456789012345678",
          host: "test.jira.com",
          username: "test@example.com",
          token: "validtoken123456",
          schedulePaused: false,
          timeJqlOverride: null,
        },
      ];

      (
        JiraConfig as unknown as { findAll: jest.Mock }
      ).findAll.mockResolvedValue(mockConfigs);

      mockServices.IJiraService.getIssuesWorked.mockResolvedValue({
        ok: false,
        statusText: "Unauthorized",
      });

      const loggerErrorSpy = jest.spyOn(mockServices.ILoggerService, "error");

      initScheduledJobs();
      await scheduledJobCallback();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        "Scheduler job failed",
        expect.objectContaining({
          errorMessage:
            "Jira API error: Unauthorized (getting work for user 987654321098765432)",
          context: {
            userId: "987654321098765432",
            guildId: "123456789012345678",
            operation: "getIssuesWorked",
          },
        })
      );

      loggerErrorSpy.mockRestore();
    });

    it("should handle no work found", async () => {
      const mockConfigs = [
        {
          userId: "987654321098765432",
          guildId: "123456789012345678",
          host: "test.jira.com",
          username: "test@example.com",
          token: "validtoken123456",
          schedulePaused: false,
          timeJqlOverride: null,
        },
      ];

      (
        JiraConfig as unknown as { findAll: jest.Mock }
      ).findAll.mockResolvedValue(mockConfigs);

      const mockSearchResults = {
        total: 0,
        issues: [],
      };

      mockServices.IJiraService.getIssuesWorked.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockSearchResults),
      });

      initScheduledJobs();
      await scheduledJobCallback();

      expect(mockServices.IJiraService.getIssuesWorked).toHaveBeenCalled();
      // Should continue to next config when no work found
    });

    it("should process issues and create worklogs", async () => {
      const mockConfigs = [
        {
          userId: "987654321098765432",
          guildId: "123456789012345678",
          host: "test.jira.com",
          username: "test@example.com",
          token: "validtoken123456",
          schedulePaused: false,
          timeJqlOverride: null,
        },
      ];

      (
        JiraConfig as unknown as { findAll: jest.Mock }
      ).findAll.mockResolvedValue(mockConfigs);

      const mockSearchResults = {
        total: 2,
        issues: [
          {
            id: "1",
            key: "TEST-1",
            fields: {
              summary: "Test issue 1",
              assignee: { displayName: "John Doe" },
            },
          },
          {
            id: "2",
            key: "TEST-2",
            fields: {
              summary: "Test issue 2",
              assignee: { displayName: "Jane Smith" },
            },
          },
        ],
      };

      const mockWorklogs = {
        worklogs: [], // No existing worklogs
      };

      mockServices.IJiraService.getIssuesWorked.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockSearchResults),
      });

      mockServices.IJiraService.getIssueWorklog.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockWorklogs),
      });

      initScheduledJobs();
      await scheduledJobCallback();

      expect(mockServices.IJiraService.getIssueWorklog).toHaveBeenCalledTimes(
        2
      );
      expect(mockServices.IJiraService.postWorklog).toHaveBeenCalledTimes(2);
      expect(EmbedBuilder).toHaveBeenCalled();
    });

    it("should skip processing when existing worklogs found", async () => {
      const mockConfigs = [
        {
          userId: "987654321098765432",
          guildId: "123456789012345678",
          host: "test.jira.com",
          username: "test@example.com",
          token: "validtoken123456",
          schedulePaused: false,
          timeJqlOverride: null,
        },
      ];

      (
        JiraConfig as unknown as { findAll: jest.Mock }
      ).findAll.mockResolvedValue(mockConfigs);

      const mockSearchResults = {
        total: 1,
        issues: [
          {
            id: "1",
            key: "TEST-1",
            fields: {
              summary: "Test issue 1",
              assignee: { displayName: "John Doe" },
            },
          },
        ],
      };

      const mockWorklogs = {
        worklogs: [
          {
            author: { emailAddress: "test@example.com" },
            timeSpentSeconds: 3600,
          },
        ],
      };

      mockServices.IJiraService.getIssuesWorked.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockSearchResults),
      });

      mockServices.IJiraService.getIssueWorklog.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockWorklogs),
      });

      initScheduledJobs();
      await scheduledJobCallback();

      expect(mockServices.IJiraService.getIssueWorklog).toHaveBeenCalledTimes(
        1
      );
      expect(mockServices.IJiraService.postWorklog).not.toHaveBeenCalled(); // Should skip posting
    });

    it("should use configured dailyHours for time distribution", async () => {
      const mockConfigs = [
        {
          userId: "987654321098765432",
          guildId: "123456789012345678",
          host: "test.jira.com",
          username: "test@example.com",
          token: "validtoken123456",
          schedulePaused: false,
          timeJqlOverride: null,
          dailyHours: 6, // Custom 6 hours instead of default 8
        },
      ];

      (
        JiraConfig as unknown as { findAll: jest.Mock }
      ).findAll.mockResolvedValue(mockConfigs);

      const mockSearchResults = {
        total: 2,
        issues: [
          {
            id: "10001",
            key: "TEST-1",
            fields: {
              summary: "Test Issue 1",
              assignee: { displayName: "Test User" },
            },
          },
          {
            id: "10002",
            key: "TEST-2",
            fields: {
              summary: "Test Issue 2",
              assignee: { displayName: "Test User" },
            },
          },
        ],
      };

      const mockWorklogs = {
        worklogs: [], // No existing worklogs
      };

      mockServices.IJiraService.getIssuesWorked.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockSearchResults),
      });

      mockServices.IJiraService.getIssueWorklog.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockWorklogs),
      });

      mockServices.IJiraService.postWorklog.mockResolvedValue({
        ok: true,
      });

      initScheduledJobs();
      await scheduledJobCallback();

      // With 6 hours configured, expect 6 * 3600 = 21600 seconds total
      // Distributed fairly across 2 issues (not necessarily evenly due to randomness)
      expect(mockServices.IJiraService.postWorklog).toHaveBeenCalledTimes(2);

      // Get the actual call arguments to verify the total
      const calls = mockServices.IJiraService.postWorklog.mock.calls;
      const firstCallTime = calls[0][4]; // time parameter is the 5th argument (index 4)
      const secondCallTime = calls[1][4];

      // Verify the total time distributed equals the configured hours
      expect(firstCallTime + secondCallTime).toBe(21600); // 6 hours = 21600 seconds

      // Verify the calls were made with correct other parameters
      expect(mockServices.IJiraService.postWorklog).toHaveBeenCalledWith(
        "test.jira.com",
        "test@example.com",
        "validtoken123456",
        "10001",
        firstCallTime,
        expect.any(Date)
      );
      expect(mockServices.IJiraService.postWorklog).toHaveBeenCalledWith(
        "test.jira.com",
        "test@example.com",
        "validtoken123456",
        "10002",
        secondCallTime,
        expect.any(Date)
      );
    });

    it("should default to 8 hours when dailyHours is not set", async () => {
      const mockConfigs = [
        {
          userId: "987654321098765432",
          guildId: "123456789012345678",
          host: "test.jira.com",
          username: "test@example.com",
          token: "validtoken123456",
          schedulePaused: false,
          timeJqlOverride: null,
          // dailyHours is undefined/null
        },
      ];

      (
        JiraConfig as unknown as { findAll: jest.Mock }
      ).findAll.mockResolvedValue(mockConfigs);

      const mockSearchResults = {
        total: 1,
        issues: [
          {
            id: "10001",
            key: "TEST-1",
            fields: {
              summary: "Test Issue 1",
              assignee: { displayName: "Test User" },
            },
          },
        ],
      };

      const mockWorklogs = {
        worklogs: [], // No existing worklogs
      };

      mockServices.IJiraService.getIssuesWorked.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockSearchResults),
      });

      mockServices.IJiraService.getIssueWorklog.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockWorklogs),
      });

      mockServices.IJiraService.postWorklog.mockResolvedValue({
        ok: true,
      });

      initScheduledJobs();
      await scheduledJobCallback();

      // With default 8 hours, expect 8 * 3600 = 28800 seconds for 1 issue
      expect(mockServices.IJiraService.postWorklog).toHaveBeenCalledWith(
        "test.jira.com",
        "test@example.com",
        "validtoken123456",
        "10001",
        28800, // 8 hours in seconds
        expect.any(Date)
      );
    });
  });
});

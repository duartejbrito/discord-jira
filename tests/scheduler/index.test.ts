import { EmbedBuilder } from "discord.js";
import * as schedule from "node-schedule";
import { client } from "../../src";
import { JiraConfig } from "../../src/db/models";
import {
  initScheduledJobs,
  tz,
  dailyRule,
  daysAgo,
  hours,
  totalSeconds,
} from "../../src/scheduler";
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
    expect(hours).toBe(8);
    expect(totalSeconds).toBe(28800); // 8 * 3600
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
    let mockContainer: any;
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
          userId: "user1",
          guildId: "guild1",
          host: "https://test.jira.com",
          username: "test@example.com",
          token: "token123",
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

      mockServices.JiraService.getIssuesWorked.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockSearchResults),
      });

      initScheduledJobs();
      await scheduledJobCallback();

      expect(JiraConfig.findAll).toHaveBeenCalledWith({
        where: { schedulePaused: false },
      });
      expect(mockServices.JiraService.getIssuesWorked).toHaveBeenCalledWith(
        "https://test.jira.com",
        "test@example.com",
        "token123",
        'assignee WAS currentUser() ON -1d AND status WAS "In Progress" ON -1d'
      );
    });

    it("should handle custom JQL override", async () => {
      const mockConfigs = [
        {
          userId: "user1",
          guildId: "guild1",
          host: "https://test.jira.com",
          username: "test@example.com",
          token: "token123",
          schedulePaused: false,
          timeJqlOverride: {
            format: jest.fn().mockReturnValue("custom JQL query"),
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

      mockServices.JiraService.getIssuesWorked.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockSearchResults),
      });

      initScheduledJobs();
      await scheduledJobCallback();

      expect(mockServices.JiraService.getIssuesWorked).toHaveBeenCalledWith(
        "https://test.jira.com",
        "test@example.com",
        "token123",
        "custom JQL query"
      );
    });

    it("should handle failed API response", async () => {
      const mockConfigs = [
        {
          userId: "user1",
          guildId: "guild1",
          host: "https://test.jira.com",
          username: "test@example.com",
          token: "token123",
          schedulePaused: false,
          timeJqlOverride: null,
        },
      ];

      (
        JiraConfig as unknown as { findAll: jest.Mock }
      ).findAll.mockResolvedValue(mockConfigs);

      mockServices.JiraService.getIssuesWorked.mockResolvedValue({
        ok: false,
        statusText: "Unauthorized",
      });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      initScheduledJobs();
      await scheduledJobCallback();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to get work for user1: Unauthorized"
      );

      consoleSpy.mockRestore();
    });

    it("should handle no work found", async () => {
      const mockConfigs = [
        {
          userId: "user1",
          guildId: "guild1",
          host: "https://test.jira.com",
          username: "test@example.com",
          token: "token123",
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

      mockServices.JiraService.getIssuesWorked.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockSearchResults),
      });

      initScheduledJobs();
      await scheduledJobCallback();

      expect(mockServices.JiraService.getIssuesWorked).toHaveBeenCalled();
      // Should continue to next config when no work found
    });

    it("should process issues and create worklogs", async () => {
      const mockConfigs = [
        {
          userId: "user1",
          guildId: "guild1",
          host: "https://test.jira.com",
          username: "test@example.com",
          token: "token123",
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

      mockServices.JiraService.getIssuesWorked.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockSearchResults),
      });

      mockServices.JiraService.getIssueWorklog.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockWorklogs),
      });

      initScheduledJobs();
      await scheduledJobCallback();

      expect(mockServices.JiraService.getIssueWorklog).toHaveBeenCalledTimes(2);
      expect(mockServices.JiraService.postWorklog).toHaveBeenCalledTimes(2);
      expect(EmbedBuilder).toHaveBeenCalled();
    });

    it("should skip processing when existing worklogs found", async () => {
      const mockConfigs = [
        {
          userId: "user1",
          guildId: "guild1",
          host: "https://test.jira.com",
          username: "test@example.com",
          token: "token123",
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

      mockServices.JiraService.getIssuesWorked.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockSearchResults),
      });

      mockServices.JiraService.getIssueWorklog.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockWorklogs),
      });

      initScheduledJobs();
      await scheduledJobCallback();

      expect(mockServices.JiraService.getIssueWorklog).toHaveBeenCalledTimes(1);
      expect(mockServices.JiraService.postWorklog).not.toHaveBeenCalled(); // Should skip posting
    });
  });
});

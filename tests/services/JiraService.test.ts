import { IJiraService } from "../../src/services/interfaces";
import { JiraService } from "../../src/services/JiraService";
import {
  createMockIHttpService,
  createMockResponse,
  testDataFactory,
} from "../test-utils";

describe("JiraService", () => {
  let jiraService: IJiraService;
  let mockHttpService: ReturnType<typeof createMockIHttpService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Use test utilities for consistent mock setup
    mockHttpService = createMockIHttpService();
    jiraService = new JiraService(mockHttpService);
  });

  describe("getServerInfo", () => {
    it("should fetch server info successfully", async () => {
      const mockServerInfo = {
        version: "8.5.0",
        baseUrl: "https://test.atlassian.net",
      };

      const mockResponse = createMockResponse({
        json: jest.fn().mockResolvedValue(mockServerInfo),
      });

      mockHttpService.fetch.mockResolvedValue(mockResponse);

      const result = await jiraService.getServerInfo(
        "test.atlassian.net",
        "user",
        "token"
      );

      expect(mockHttpService.fetch).toHaveBeenCalledWith(
        "https://test.atlassian.net/rest/api/3/serverInfo",
        {
          method: "GET",
          headers: {
            Authorization: expect.stringContaining("Basic "),
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      expect(result).toEqual(mockServerInfo);
    });

    it("should handle failed server info request", async () => {
      const mockResponse = createMockResponse({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      mockHttpService.fetch.mockResolvedValue(mockResponse);

      await expect(
        jiraService.getServerInfo("test.atlassian.net", "user", "invalid-token")
      ).rejects.toThrow("Server info request failed: 401");
    });
  });

  describe("getIssuesWorked", () => {
    it("should fetch issues successfully", async () => {
      const mockIssues = testDataFactory.createIssueData({
        issues: [
          testDataFactory.createIssueData({ key: "TEST-1" }),
          testDataFactory.createIssueData({ key: "TEST-2" }),
        ],
      });

      const mockResponse = createMockResponse({
        json: jest.fn().mockResolvedValue(mockIssues),
      });

      mockHttpService.fetch.mockResolvedValue(mockResponse);

      const result = await jiraService.getIssuesWorked(
        "test.atlassian.net",
        "user",
        "token",
        "project = TEST"
      );

      expect(mockHttpService.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/rest/api/3/search"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: expect.stringContaining("Basic "),
          }),
        })
      );

      expect(result).toBe(mockResponse);
    });

    it("should use default JQL when no JQL parameter is provided", async () => {
      const mockIssues = testDataFactory.createIssueData({
        issues: [testDataFactory.createIssueData({ key: "DEFAULT-1" })],
      });

      const mockResponse = createMockResponse({
        json: jest.fn().mockResolvedValue(mockIssues),
      });

      mockHttpService.fetch.mockResolvedValue(mockResponse);

      // Call without JQL parameter to test default
      const result = await jiraService.getIssuesWorked(
        "test.atlassian.net",
        "user",
        "token"
      );

      // Verify the call was made with the default JQL
      expect(mockHttpService.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/rest/api/3/search"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining(
            'assignee WAS currentUser() ON -1d AND status WAS \\"In Progress\\" ON -1d'
          ),
        })
      );

      expect(result).toBe(mockResponse);
    });
  });

  describe("getCurrentUser", () => {
    it("should fetch current user successfully", async () => {
      const mockUser = {
        displayName: "Test User",
        emailAddress: "test@example.com",
        accountId: "123456",
      };

      const mockResponse = createMockResponse({
        json: jest.fn().mockResolvedValue(mockUser),
      });

      mockHttpService.fetch.mockResolvedValue(mockResponse);

      const result = await jiraService.getCurrentUser(
        "test.atlassian.net",
        "user",
        "token"
      );

      expect(mockHttpService.fetch).toHaveBeenCalledWith(
        "https://test.atlassian.net/rest/api/3/myself",
        {
          method: "GET",
          headers: {
            Authorization: expect.stringContaining("Basic "),
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      expect(result).toEqual(mockUser);
    });

    it("should handle failed current user request", async () => {
      const mockResponse = createMockResponse({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      });

      mockHttpService.fetch.mockResolvedValue(mockResponse);

      await expect(
        jiraService.getCurrentUser(
          "test.atlassian.net",
          "user",
          "invalid-token"
        )
      ).rejects.toThrow("Current user request failed: 403");
    });
  });

  describe("searchIssues", () => {
    it("should search issues successfully", async () => {
      const mockIssues = {
        issues: [
          { key: "TEST-1", summary: "Test Issue 1" },
          { key: "TEST-2", summary: "Test Issue 2" },
        ],
        total: 2,
      };

      const mockResponse = createMockResponse({
        json: jest.fn().mockResolvedValue(mockIssues),
      });

      mockHttpService.fetch.mockResolvedValue(mockResponse);

      const result = await jiraService.searchIssues(
        "test.atlassian.net",
        "user",
        "token",
        "project = TEST"
      );

      expect(mockHttpService.fetch).toHaveBeenCalledWith(
        "https://test.atlassian.net/rest/api/3/search?jql=project%20%3D%20TEST",
        {
          method: "GET",
          headers: {
            Authorization: expect.stringContaining("Basic "),
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      expect(result).toEqual(mockIssues);
    });

    it("should handle failed search request", async () => {
      const mockResponse = createMockResponse({
        ok: false,
        status: 400,
        statusText: "Bad Request",
      });

      mockHttpService.fetch.mockResolvedValue(mockResponse);

      await expect(
        jiraService.searchIssues(
          "test.atlassian.net",
          "user",
          "token",
          "invalid jql"
        )
      ).rejects.toThrow("Issues search failed: 400");
    });
  });

  describe("getIssueWorklog", () => {
    it("should fetch issue worklog successfully", async () => {
      const mockWorklog = testDataFactory.createWorklogData();
      const mockResponse = createMockResponse({
        json: jest.fn().mockResolvedValue(mockWorklog),
      });

      mockHttpService.fetch.mockResolvedValue(mockResponse);

      const date = new Date("2024-01-15T10:00:00.000Z");
      const result = await jiraService.getIssueWorklog(
        "test.atlassian.net",
        "user",
        "token",
        "TEST-123",
        date
      );

      expect(mockHttpService.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/rest/api/3/issue/TEST-123/worklog"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: expect.stringContaining("Basic "),
          }),
        })
      );

      expect(result).toBe(mockResponse);
    });
  });

  describe("postWorklog", () => {
    it("should post worklog successfully", async () => {
      const mockWorklog = testDataFactory.createWorklogData();
      const mockResponse = createMockResponse({
        json: jest.fn().mockResolvedValue(mockWorklog),
      });

      mockHttpService.fetch.mockResolvedValue(mockResponse);

      const result = await jiraService.postWorklog(
        "test.atlassian.net",
        "user",
        "token",
        "TEST-123",
        3600,
        new Date("2024-01-15T09:00:00.000Z")
      );

      expect(mockHttpService.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/rest/api/3/issue/TEST-123/worklog"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("timeSpentSeconds"),
        })
      );

      expect(result).toBe(mockResponse);
    });

    it("should post worklog with notifyUsers parameter", async () => {
      const mockWorklog = testDataFactory.createWorklogData();
      const mockResponse = createMockResponse({
        json: jest.fn().mockResolvedValue(mockWorklog),
      });

      mockHttpService.fetch.mockResolvedValue(mockResponse);

      const result = await jiraService.postWorklog(
        "test.atlassian.net",
        "user",
        "token",
        "TEST-123",
        3600,
        new Date("2024-01-15T09:00:00.000Z"),
        true
      );

      expect(mockHttpService.fetch).toHaveBeenCalledWith(
        expect.stringContaining("notifyUsers=true"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("timeSpentSeconds"),
        })
      );

      expect(result).toBe(mockResponse);
    });
  });
});

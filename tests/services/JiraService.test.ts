import { JiraService } from "../../src/services/JiraService";
import {
  createMockHttpService,
  createMockResponse,
  testDataFactory,
} from "../test-utils";

describe("JiraService", () => {
  let jiraService: JiraService;
  let mockHttpService: ReturnType<typeof createMockHttpService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Use test utilities for consistent mock setup
    mockHttpService = createMockHttpService();
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
  });
});

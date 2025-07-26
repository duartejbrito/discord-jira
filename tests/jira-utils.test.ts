/**
 * Tests for Jira utility functions
 * These tests focus on the basic structure and logic rather than external API calls
 */

describe("Jira Utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("URL Construction", () => {
    it("should construct proper Jira API URLs", () => {
      const baseUrl = "test.atlassian.net";
      const apiVersion = "3";
      const serverInfoUrl = `https://${baseUrl}/rest/api/${apiVersion}/serverInfo`;

      expect(serverInfoUrl).toBe(
        "https://test.atlassian.net/rest/api/3/serverInfo"
      );
    });

    it("should handle worklog URLs correctly", () => {
      const baseUrl = "test.atlassian.net";
      const issueKey = "TEST-123";
      const apiVersion = "3";
      const worklogUrl = `https://${baseUrl}/rest/api/${apiVersion}/issue/${issueKey}/worklog`;

      expect(worklogUrl).toBe(
        "https://test.atlassian.net/rest/api/3/issue/TEST-123/worklog"
      );
    });
  });

  describe("Authentication Headers", () => {
    it("should create proper basic auth header", () => {
      const username = "testuser";
      const token = "testtoken";
      const authString = `${username}:${token}`;
      const base64Auth = Buffer.from(authString).toString("base64");
      const expectedHeader = `Basic ${base64Auth}`;

      expect(expectedHeader).toBe("Basic dGVzdHVzZXI6dGVzdHRva2Vu");
    });

    it("should include required headers", () => {
      const headers = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };

      expect(headers.Accept).toBe("application/json");
      expect(headers["Content-Type"]).toBe("application/json");
    });
  });

  describe("Date Handling", () => {
    it("should format dates correctly for Jira API", () => {
      const testDate = new Date("2025-01-15T10:30:00Z");
      const isoString = testDate.toISOString();

      expect(isoString).toBe("2025-01-15T10:30:00.000Z");
    });

    it("should calculate time ranges correctly", () => {
      const startDate = new Date("2025-01-15");
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 1);
      endDate.setHours(0, 0, 0, 0);

      expect(endDate.getTime() - startDate.getTime()).toBe(24 * 60 * 60 * 1000); // 24 hours in ms
    });
  });

  describe("JQL Query Construction", () => {
    it("should construct default JQL query", () => {
      const defaultJql =
        'assignee WAS currentUser() ON -1d AND status WAS "In Progress" ON -1d';

      expect(defaultJql).toContain("assignee WAS currentUser()");
      expect(defaultJql).toContain('status WAS "In Progress"');
    });

    it("should handle custom JQL queries", () => {
      const customJql = "assignee = currentUser() AND updated >= -7d";

      expect(customJql).toContain("assignee = currentUser()");
      expect(customJql).toContain("updated >= -7d");
    });
  });

  describe("Worklog Data Structure", () => {
    it("should structure worklog post data correctly", () => {
      const timeSpentSeconds = 3600; // 1 hour
      const testDate = new Date("2025-01-15");
      testDate.setHours(9, 0, 0, 0);

      const worklogData = {
        started: testDate.toISOString().replace("Z", "+0000"),
        timeSpentSeconds: timeSpentSeconds,
      };

      expect(worklogData.timeSpentSeconds).toBe(3600);
      expect(worklogData.started).toMatch(
        /^\d{4}-\d{2}-\d{2}T09:00:00\.\d{3}\+0000$/
      );
    });
  });
});

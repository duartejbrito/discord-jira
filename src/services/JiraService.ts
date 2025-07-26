import { Response } from "node-fetch";
import { IHttpService } from "./interfaces";

export class JiraService {
  private readonly version = "3";
  private readonly restUrl = `/rest/api/${this.version}`;

  // eslint-disable-next-line no-unused-vars
  constructor(private httpService: IHttpService) {}

  private getHeaders(username: string, token: string): Record<string, string> {
    return {
      Authorization: `Basic ${Buffer.from(`${username}:${token}`).toString(
        "base64"
      )}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  private buildUrl(baseUrl: string, endpoint: string): string {
    return `https://${baseUrl}${this.restUrl}${endpoint}`;
  }

  async getServerInfo(
    url: string,
    username: string,
    token: string
  ): Promise<Record<string, unknown>> {
    const response = await this.httpService.fetch(
      this.buildUrl(url, "/serverInfo"),
      {
        method: "GET",
        headers: this.getHeaders(username, token),
      }
    );

    if (!response.ok) {
      throw new Error(`Server info request failed: ${response.status}`);
    }

    return (await response.json()) as Record<string, unknown>;
  }

  async getCurrentUser(
    url: string,
    username: string,
    token: string
  ): Promise<Record<string, unknown>> {
    const response = await this.httpService.fetch(
      this.buildUrl(url, "/myself"),
      {
        method: "GET",
        headers: this.getHeaders(username, token),
      }
    );

    if (!response.ok) {
      throw new Error(`Current user request failed: ${response.status}`);
    }

    return (await response.json()) as Record<string, unknown>;
  }

  async searchIssues(
    url: string,
    username: string,
    token: string,
    jql: string
  ): Promise<Record<string, unknown>> {
    const response = await this.httpService.fetch(
      this.buildUrl(url, `/search?jql=${encodeURIComponent(jql)}`),
      {
        method: "GET",
        headers: this.getHeaders(username, token),
      }
    );

    if (!response.ok) {
      throw new Error(`Issues search failed: ${response.status}`);
    }

    return (await response.json()) as Record<string, unknown>;
  }

  async getIssuesWorked(
    url: string,
    username: string,
    token: string,
    // eslint-disable-next-line quotes
    jql = 'assignee WAS currentUser() ON -1d AND status WAS "In Progress" ON -1d'
  ): Promise<Response> {
    const bodyData = {
      fields: ["key", "summary", "assignee"],
      fieldsByKeys: false,
      jql: jql,
      maxResults: 50,
      startAt: 0,
      validateQuery: "strict",
    };

    return await this.httpService.fetch(this.buildUrl(url, "/search"), {
      method: "POST",
      headers: this.getHeaders(username, token),
      body: JSON.stringify(bodyData),
    });
  }

  async getIssueWorklog(
    url: string,
    username: string,
    token: string,
    issueKey: string,
    date: Date
  ): Promise<Response> {
    const startedAfter = new Date(date);
    startedAfter.setHours(0, 0, 0, 0);

    const startedBefore = new Date(startedAfter);
    startedBefore.setDate(date.getDate() + 1);
    startedBefore.setHours(0, 0, 0, 0);

    const startedAfterTime = Date.UTC(
      startedAfter.getFullYear(),
      startedAfter.getMonth(),
      startedAfter.getDate()
    );
    const startedBeforeTime = Date.UTC(
      startedBefore.getFullYear(),
      startedBefore.getMonth(),
      startedBefore.getDate()
    );

    return await this.httpService.fetch(
      this.buildUrl(
        url,
        `/issue/${issueKey}/worklog?startedAfter=${startedAfterTime}&startedBefore=${startedBeforeTime}`
      ),
      {
        method: "GET",
        headers: this.getHeaders(username, token),
      }
    );
  }

  async postWorklog(
    url: string,
    username: string,
    token: string,
    issueKey: string,
    timeSpentSeconds: number,
    date: Date,
    notifyUsers = false
  ): Promise<Response> {
    const started = new Date(date);
    started.setHours(9, 0, 0, 0);

    const bodyData = {
      started: started.toISOString().replace("Z", "+0000"),
      timeSpentSeconds: timeSpentSeconds,
    };

    return await this.httpService.fetch(
      this.buildUrl(
        url,
        `/issue/${issueKey}/worklog?notifyUsers=${notifyUsers}`
      ),
      {
        method: "POST",
        headers: this.getHeaders(username, token),
        body: JSON.stringify(bodyData),
      }
    );
  }
}

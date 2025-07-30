import { Response as NodeFetchResponse } from "node-fetch";
import { ApplicationError, ErrorHandler, ErrorType } from "./ErrorHandler";
import { IHttpService } from "./HttpService";
import { InputValidator } from "./InputValidator";
import { ILoggerService } from "./LoggerService";
import { RetryUtil } from "./RetryUtil";
import { ServiceContainer } from "./ServiceContainer";

/* eslint-disable no-unused-vars */
export interface IJiraService {
  getServerInfo(
    url: string,
    username: string,
    token: string
  ): Promise<Record<string, unknown>>;

  getCurrentUser(
    url: string,
    username: string,
    token: string
  ): Promise<Record<string, unknown>>;

  searchIssues(
    url: string,
    username: string,
    token: string,
    jql: string
  ): Promise<Record<string, unknown>>;

  getIssuesWorked(
    url: string,
    username: string,
    token: string,
    jql?: string
  ): Promise<NodeFetchResponse>;

  getIssueWorklog(
    url: string,
    username: string,
    token: string,
    issueKey: string,
    date: Date
  ): Promise<NodeFetchResponse>;

  postWorklog(
    url: string,
    username: string,
    token: string,
    issueKey: string,
    timeSpentSeconds: number,
    date: Date,
    notifyUsers?: boolean
  ): Promise<NodeFetchResponse>;
}
/* eslint-enable no-unused-vars */

export class JiraService implements IJiraService {
  private readonly version = "3";
  private readonly restUrl = `/rest/api/${this.version}`;
  private static instance: IJiraService;
  private logger: ILoggerService;

  // eslint-disable-next-line no-unused-vars
  constructor(private httpService: IHttpService) {
    this.logger =
      ServiceContainer.getInstance().get<ILoggerService>("ILoggerService");
  }

  static getInstance(): IJiraService {
    if (!JiraService.instance) {
      JiraService.instance = new JiraService(
        ServiceContainer.getInstance().get<IHttpService>("IHttpService")
      );
    }
    return JiraService.instance;
  }

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
    // Validate inputs
    const validatedUrl = InputValidator.validateJiraHost(url);
    const validatedUsername = InputValidator.validateEmail(username);
    const validatedToken = InputValidator.validateApiToken(token);

    try {
      const response = await RetryUtil.withHttpRetry(
        () =>
          this.httpService.fetch(this.buildUrl(validatedUrl, "/serverInfo"), {
            method: "GET",
            headers: this.getHeaders(validatedUsername, validatedToken),
          }) as Promise<NodeFetchResponse>,
        { maxAttempts: 2 }, // Less retries for auth/validation calls
        this.logger,
        "getServerInfo"
      );

      if (!response.ok) {
        throw ErrorHandler.wrapJiraError(response, "getting server info");
      }

      return (await response.json()) as Record<string, unknown>;
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }

      this.logger.error("Failed to get server info", {
        url: validatedUrl,
        username: validatedUsername,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new ApplicationError(
        "Failed to connect to Jira server",
        ErrorType.JIRA_API_ERROR,
        true,
        undefined,
        {
          originalError: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  async getCurrentUser(
    url: string,
    username: string,
    token: string
  ): Promise<Record<string, unknown>> {
    // Validate inputs
    const validatedUrl = InputValidator.validateJiraHost(url);
    const validatedUsername = InputValidator.validateEmail(username);
    const validatedToken = InputValidator.validateApiToken(token);

    const response = await this.httpService.fetch(
      this.buildUrl(validatedUrl, "/myself"),
      {
        method: "GET",
        headers: this.getHeaders(validatedUsername, validatedToken),
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
    // Validate inputs
    const validatedUrl = InputValidator.validateJiraHost(url);
    const validatedUsername = InputValidator.validateEmail(username);
    const validatedToken = InputValidator.validateApiToken(token);
    const validatedJql = InputValidator.validateJQL(jql);

    if (!validatedJql) {
      throw new ApplicationError(
        "Invalid or empty JQL query",
        ErrorType.VALIDATION_ERROR,
        true
      );
    }

    const response = await this.httpService.fetch(
      this.buildUrl(
        validatedUrl,
        `/search?jql=${encodeURIComponent(validatedJql)}`
      ),
      {
        method: "GET",
        headers: this.getHeaders(validatedUsername, validatedToken),
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
  ): Promise<NodeFetchResponse> {
    // Validate inputs
    const validatedUrl = InputValidator.validateJiraHost(url);
    const validatedUsername = InputValidator.validateEmail(username);
    const validatedToken = InputValidator.validateApiToken(token);
    const validatedJql = InputValidator.validateJQL(jql) || jql; // Use default if validation returns undefined

    const bodyData = {
      fields: ["key", "summary", "assignee"],
      fieldsByKeys: false,
      jql: validatedJql,
      maxResults: 50,
      startAt: 0,
      validateQuery: "strict",
    };

    return await this.httpService.fetch(
      this.buildUrl(validatedUrl, "/search"),
      {
        method: "POST",
        headers: this.getHeaders(validatedUsername, validatedToken),
        body: JSON.stringify(bodyData),
      }
    );
  }

  async getIssueWorklog(
    url: string,
    username: string,
    token: string,
    issueKey: string,
    date: Date
  ): Promise<NodeFetchResponse> {
    // Validate inputs
    const validatedUrl = InputValidator.validateJiraHost(url);
    const validatedUsername = InputValidator.validateEmail(username);
    const validatedToken = InputValidator.validateApiToken(token);
    const validatedIssueKey = InputValidator.validateString(
      issueKey,
      "Issue key",
      {
        required: true,
        minLength: 3,
        maxLength: 50,
        pattern: /^[A-Z]+-\d+$/,
      }
    );

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
        validatedUrl,
        `/issue/${validatedIssueKey}/worklog?startedAfter=${startedAfterTime}&startedBefore=${startedBeforeTime}`
      ),
      {
        method: "GET",
        headers: this.getHeaders(validatedUsername, validatedToken),
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
  ): Promise<NodeFetchResponse> {
    // Validate inputs
    const validatedUrl = InputValidator.validateJiraHost(url);
    const validatedUsername = InputValidator.validateEmail(username);
    const validatedToken = InputValidator.validateApiToken(token);
    const validatedIssueKey = InputValidator.validateString(
      issueKey,
      "Issue key",
      {
        required: true,
        minLength: 3,
        maxLength: 50,
        pattern: /^[A-Z]+-\d+$/,
      }
    );
    const validatedTimeSpent = InputValidator.validateNumber(
      timeSpentSeconds,
      "Time spent",
      {
        required: true,
        min: 60, // Minimum 1 minute
        max: 86400, // Maximum 24 hours
        integer: true,
      }
    );

    const started = new Date(date);
    started.setHours(9, 0, 0, 0);

    const bodyData = {
      started: started.toISOString().replace("Z", "+0000"),
      timeSpentSeconds: validatedTimeSpent,
    };

    return await this.httpService.fetch(
      this.buildUrl(
        validatedUrl,
        `/issue/${validatedIssueKey}/worklog?notifyUsers=${notifyUsers}`
      ),
      {
        method: "POST",
        headers: this.getHeaders(validatedUsername, validatedToken),
        body: JSON.stringify(bodyData),
      }
    );
  }
}

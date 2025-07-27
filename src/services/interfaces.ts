/* eslint-disable no-unused-vars */
// Service interfaces for dependency injection and testing
import {
  RequestInit as NodeFetchRequestInit,
  Response as NodeFetchResponse,
} from "node-fetch";

export interface IHttpService {
  fetch(
    url: string,
    options?: NodeFetchRequestInit
  ): Promise<NodeFetchResponse>;
}

export interface IDiscordService {
  login(token: string): Promise<void>;
  getChannel(channelId: string): unknown;
  isReady(): boolean;
}

export interface IDatabaseService {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

export interface ILoggerService {
  // Core logging methods
  info(message: string, details?: Record<string, unknown>): void;
  warn(message: string, details?: Record<string, unknown>): void;
  debug(message: string, details?: Record<string, unknown>): void;
  error(error: Error | string, details?: Record<string, unknown>): void;

  // Initialization method for Discord logging
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialize(
    client: any,
    ownerLogChannelId: string,
    discordLogging?: boolean
  ): void;

  // Backward compatibility methods (legacy interface)
  logInfo(message: string, args?: Record<string, unknown>): void;
  logWarn(message: string, args?: Record<string, unknown>): void;
  logDebug(message: string, args?: Record<string, unknown>): void;
  logError(message: string | Error, args?: Record<string, unknown>): void;
}

export interface IConfigService {
  get(key: string): string | undefined;
  getRequired(key: string): string;

  // Utility methods for common config values
  getDiscordToken(): string;
  getClientId(): string;
  getOwnerUserId(): string;
  getOwnerGuildId(): string;
  getDatabaseUrl(): string;
  isProduction(): boolean;
  isDevelopment(): boolean;
  isTest(): boolean;
}

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

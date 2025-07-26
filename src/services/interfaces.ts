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
  info(message: string, details?: object): void;
  error(error: Error): void;
  warn(message: string, details?: object): void;
  debug(message: string, details?: object): void;
}

export interface IConfigService {
  get(key: string): string | undefined;
  getRequired(key: string): string;
}

export interface IJiraService {
  searchIssues(jql: string, config: unknown): Promise<unknown>;
  getWorklogs(issueKey: string, config: unknown): Promise<unknown>;
  getUser(username: string, config: unknown): Promise<unknown>;
}

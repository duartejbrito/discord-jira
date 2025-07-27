import { ConfigService } from "./ConfigService";
import { HttpService } from "./HttpService";
import {
  IHttpService,
  IConfigService,
  ILoggerService,
  IJiraService,
} from "./interfaces";
import { JiraService } from "./JiraService";
import { LoggerService } from "./LoggerService";

/**
 * Simple dependency injection container for managing service instances
 */
export class ServiceContainer {
  private static instance: ServiceContainer;
  private services = new Map<string, unknown>();

  private constructor() {
    // Empty constructor for singleton
  }

  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  /**
   * Register a service instance with the container
   */
  register<T>(name: string, service: T): void {
    this.services.set(name, service);
  }

  /**
   * Get a service instance from the container
   */
  get<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not found in container`);
    }
    return service as T;
  }

  /**
   * Initialize all core services with proper dependencies
   */
  static initializeServices(): ServiceContainer {
    const container = ServiceContainer.getInstance();

    // Register Config service (no dependencies)
    const configService = ConfigService.getInstance();
    container.register<IConfigService>("IConfigService", configService);

    // Register Logger service (no dependencies - initialized later with Discord client)
    const loggerService = LoggerService.getInstance();
    container.register<ILoggerService>("ILoggerService", loggerService);

    // Register HTTP service (no dependencies)
    const httpService = HttpService.getInstance();
    container.register<IHttpService>("IHttpService", httpService);

    // Register Jira service (depends on HTTP service)
    const jiraService = JiraService.getInstance();
    container.register<IJiraService>("IJiraService", jiraService);

    return container;
  }

  /**
   * Clear all services (useful for testing)
   */
  clear(): void {
    this.services.clear();
  }
}

// Example usage:
// const container = ServiceContainer.initializeServices();
// const jiraService = container.get<JiraService>("JiraService");
// const serverInfo = await jiraService.getServerInfo(url, username, token);

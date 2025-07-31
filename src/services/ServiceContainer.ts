import { ConfigService, IConfigService } from "./ConfigService";
import { EncryptionService, IEncryptionService } from "./EncryptionService";
import { HealthCheckService, IHealthCheckService } from "./HealthCheckService";
import { HttpService, IHttpService } from "./HttpService";
import { InputValidator } from "./InputValidator";
import { IJiraService, JiraService } from "./JiraService";
import { ILoggerService, LoggerService } from "./LoggerService";
import { IRateLimitService, RateLimitService } from "./RateLimitService";

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

    // Register new services (excluding ErrorHandler which is static)
    const inputValidator = new InputValidator();
    container.register("InputValidator", inputValidator);

    const rateLimitService = new RateLimitService();

    // Set up rate limiting rules
    rateLimitService.setRule("setup", {
      maxAttempts: 3,
      windowMs: 60000, // 1 minute
    });

    rateLimitService.setRule("time", {
      maxAttempts: 5,
      windowMs: 300000, // 5 minutes
    });

    rateLimitService.setRule("hours", {
      maxAttempts: 10,
      windowMs: 60000, // 1 minute
    });

    container.register<IRateLimitService>(
      "IRateLimitService",
      rateLimitService
    );

    const encryptionService = new EncryptionService(configService);
    container.register<IEncryptionService>(
      "IEncryptionService",
      encryptionService
    );

    const healthCheckService = new HealthCheckService(loggerService);
    container.register<IHealthCheckService>(
      "IHealthCheckService",
      healthCheckService
    );

    return container;
  }

  /**
   * Clear all services (useful for testing)
   */
  clear(): void {
    this.services.clear();
  }

  /**
   * Static getter methods for commonly used services
   */
  static getEncryptionService(): IEncryptionService {
    const container = ServiceContainer.getInstance();
    return container.get<IEncryptionService>("IEncryptionService");
  }

  static getLoggerService(): ILoggerService {
    const container = ServiceContainer.getInstance();
    return container.get<ILoggerService>("ILoggerService");
  }

  static getJiraService(): IJiraService {
    const container = ServiceContainer.getInstance();
    return container.get<IJiraService>("IJiraService");
  }

  static getRateLimitService(): IRateLimitService {
    const container = ServiceContainer.getInstance();
    return container.get<IRateLimitService>("IRateLimitService");
  }

  static getHealthCheckService(): IHealthCheckService {
    const container = ServiceContainer.getInstance();
    return container.get<IHealthCheckService>("IHealthCheckService");
  }

  static getConfigService(): IConfigService {
    const container = ServiceContainer.getInstance();
    return container.get<IConfigService>("IConfigService");
  }

  static getHttpService(): IHttpService {
    const container = ServiceContainer.getInstance();
    return container.get<IHttpService>("IHttpService");
  }
}

// Example usage:
// const container = ServiceContainer.initializeServices();
// const jiraService = container.get<JiraService>("JiraService");
// const serverInfo = await jiraService.getServerInfo(url, username, token);

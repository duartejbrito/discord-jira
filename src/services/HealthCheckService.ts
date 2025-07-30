import { ILoggerService } from "./LoggerService";

export interface HealthCheckResult {
  name: string;
  status: "healthy" | "unhealthy" | "degraded";
  message: string;
  duration: number;
  timestamp: number;
  details?: Record<string, unknown>;
}

export interface SystemHealth {
  overall: "healthy" | "unhealthy" | "degraded";
  checks: HealthCheckResult[];
  uptime: number;
  timestamp: number;
}

/* eslint-disable no-unused-vars */
export interface IHealthCheckService {
  registerCheck(
    name: string,
    checkFunction: () => Promise<HealthCheckResult>
  ): void;
  runAllChecks(): Promise<SystemHealth>;
  getSystemMetrics(): Record<string, unknown>;
}
/* eslint-enable no-unused-vars */

export class HealthCheckService implements IHealthCheckService {
  private readonly checks = new Map<string, () => Promise<HealthCheckResult>>();
  private readonly logger: ILoggerService;
  private readonly startTime: number;

  constructor(logger: ILoggerService) {
    this.logger = logger;
    this.startTime = Date.now();

    // Register default health checks
    this.registerCheck("database", () => this.checkDatabase());
    this.registerCheck("discord", () => this.checkDiscordConnection());
    this.registerCheck("memory", () => this.checkMemoryUsage());
    this.registerCheck("services", () => this.checkServices());
  }

  /**
   * Register a custom health check
   */
  registerCheck(
    name: string,
    checkFunction: () => Promise<HealthCheckResult>
  ): void {
    this.checks.set(name, checkFunction);
  }

  /**
   * Run all health checks
   */
  async runAllChecks(): Promise<SystemHealth> {
    const results: HealthCheckResult[] = [];

    for (const [name, checkFunction] of this.checks) {
      try {
        const result = await this.runSingleCheck(name, checkFunction);
        results.push(result);
      } catch (error) {
        results.push({
          name,
          status: "unhealthy",
          message: error instanceof Error ? error.message : String(error),
          duration: 0,
          timestamp: Date.now(),
        });
      }
    }

    const overall = this.determineOverallHealth(results);
    const uptime = Date.now() - this.startTime;

    const systemHealth: SystemHealth = {
      overall,
      checks: results,
      uptime,
      timestamp: Date.now(),
    };

    // Log health check results
    this.logger.info("Health check completed", {
      overall,
      healthyChecks: results.filter((r) => r.status === "healthy").length,
      totalChecks: results.length,
      uptime: Math.round(uptime / 1000),
    });

    return systemHealth;
  }

  /**
   * Run a single health check with timeout and error handling
   */
  private async runSingleCheck(
    name: string,
    checkFunction: () => Promise<HealthCheckResult>
  ): Promise<HealthCheckResult> {
    const startTime = performance.now();

    try {
      // Add timeout to prevent hanging checks
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Health check timeout")), 10000);
      });

      const result = await Promise.race([checkFunction(), timeoutPromise]);
      result.duration = performance.now() - startTime;
      result.timestamp = Date.now();

      return result;
    } catch (error) {
      return {
        name,
        status: "unhealthy",
        message: error instanceof Error ? error.message : String(error),
        duration: performance.now() - startTime,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Determine overall system health based on individual checks
   */
  private determineOverallHealth(
    results: HealthCheckResult[]
  ): "healthy" | "unhealthy" | "degraded" {
    const unhealthyCount = results.filter(
      (r) => r.status === "unhealthy"
    ).length;
    const degradedCount = results.filter((r) => r.status === "degraded").length;

    if (unhealthyCount > 0) {
      return "unhealthy";
    }

    if (degradedCount > 0) {
      return "degraded";
    }

    return "healthy";
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<HealthCheckResult> {
    try {
      const { default: db } = await import("../db");

      const startTime = performance.now();
      await db.authenticate();
      const duration = performance.now() - startTime;

      return {
        name: "database",
        status: duration > 1000 ? "degraded" : "healthy",
        message:
          duration > 1000
            ? "Database responding slowly"
            : "Database connection healthy",
        duration,
        timestamp: Date.now(),
        details: {
          responseTime: `${Math.round(duration)}ms`,
          dialect: db.getDialect(),
        },
      };
    } catch (error) {
      return {
        name: "database",
        status: "unhealthy",
        message: `Database connection failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        duration: 0,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Check Discord connection
   */
  private async checkDiscordConnection(): Promise<HealthCheckResult> {
    try {
      const { client } = await import("../index");

      if (!client.isReady()) {
        return {
          name: "discord",
          status: "unhealthy",
          message: "Discord client not ready",
          duration: 0,
          timestamp: Date.now(),
        };
      }

      const guilds = client.guilds.cache.size;
      const uptime = client.uptime || 0;

      return {
        name: "discord",
        status: "healthy",
        message: "Discord connection healthy",
        duration: 0,
        timestamp: Date.now(),
        details: {
          guilds,
          uptime: Math.round(uptime / 1000),
          ping: client.ws.ping,
        },
      };
    } catch (error) {
      return {
        name: "discord",
        status: "unhealthy",
        message: `Discord connection check failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        duration: 0,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemoryUsage(): Promise<HealthCheckResult> {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const totalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const usage = heapUsedMB / totalMB;

    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    let message = "Memory usage normal";

    if (usage > 0.9) {
      status = "unhealthy";
      message = "Memory usage critical";
    } else if (usage > 0.7) {
      status = "degraded";
      message = "Memory usage high";
    }

    return {
      name: "memory",
      status,
      message,
      duration: 0,
      timestamp: Date.now(),
      details: {
        heapUsed: `${heapUsedMB}MB`,
        heapTotal: `${totalMB}MB`,
        usage: `${Math.round(usage * 100)}%`,
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      },
    };
  }

  /**
   * Check service container health
   */
  private async checkServices(): Promise<HealthCheckResult> {
    try {
      const { ServiceContainer } = await import("./ServiceContainer");
      const container = ServiceContainer.getInstance();

      // Try to get core services
      const services = [
        "ILoggerService",
        "IConfigService",
        "IJiraService",
        "IHttpService",
      ];
      const serviceStatus: Record<string, boolean> = {};

      for (const serviceName of services) {
        try {
          container.get(serviceName);
          serviceStatus[serviceName] = true;
        } catch {
          serviceStatus[serviceName] = false;
        }
      }

      const failedServices = Object.entries(serviceStatus)
        .filter(([, status]) => !status)
        .map(([name]) => name);

      if (failedServices.length > 0) {
        return {
          name: "services",
          status: "unhealthy",
          message: `Failed to load services: ${failedServices.join(", ")}`,
          duration: 0,
          timestamp: Date.now(),
          details: serviceStatus,
        };
      }

      return {
        name: "services",
        status: "healthy",
        message: "All services loaded successfully",
        duration: 0,
        timestamp: Date.now(),
        details: serviceStatus,
      };
    } catch (error) {
      return {
        name: "services",
        status: "unhealthy",
        message: `Service check failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        duration: 0,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(): Record<string, unknown> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      uptime: process.uptime(),
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    };
  }
}

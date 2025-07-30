import { Options, Sequelize } from "sequelize";
import { IConfigService } from "../services/ConfigService";
import { ILoggerService } from "../services/LoggerService";
import { ServiceContainer } from "../services/ServiceContainer";

// Lazy-initialized database instance
let dbInstance: Sequelize | null = null;

// Function to get config service
function getConfigService(): IConfigService {
  const container = ServiceContainer.getInstance();
  return container.get<IConfigService>("IConfigService");
}

// Function to initialize database configuration
function initializeDatabase(): Sequelize {
  // Initialize services if not already done
  ServiceContainer.initializeServices();

  const configService = getConfigService();

  return new Sequelize(configService.getPgConnectionString()!, {
    dialect: "postgres",
    benchmark: true,
    logging: configService.isPgLoggingEnabled()
      ? (sql, timing) => {
          try {
            const container = ServiceContainer.getInstance();
            const loggerService =
              container.get<ILoggerService>("ILoggerService");
            loggerService.logDebug("[DB] Execution", {
              Timing: `${timing?.toString()}ms`,
              Sql: sql,
            });
          } catch {
            // Fallback to console if service container is not ready
            console.debug("[DB] Execution", {
              Timing: `${timing?.toString()}ms`,
              Sql: sql,
            });
          }
        }
      : false,
  } as Options);
}

// Lazy getter for database instance
function getDatabase(): Sequelize {
  if (!dbInstance) {
    dbInstance = initializeDatabase();
  }
  return dbInstance;
}

// Create a proxy object that behaves like Sequelize but initializes lazily
const db = new Proxy({} as Sequelize, {
  get(target, prop) {
    const instance = getDatabase();
    const value = (instance as unknown as Record<string | symbol, unknown>)[
      prop
    ];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export default db;

import { Options, Sequelize } from "sequelize";
import { config } from "../config";
import { ILoggerService } from "../services/interfaces";
import { ServiceContainer } from "../services/ServiceContainer";

const db: Sequelize = new Sequelize(config.PG_CONNECTION_STRING!, {
  dialect: "postgres",
  benchmark: true,
  logging: config.PG_LOGGING
    ? (sql, timing) => {
        try {
          const container = ServiceContainer.getInstance();
          const loggerService = container.get<ILoggerService>("ILoggerService");
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

export default db;

import { Options, Sequelize } from "sequelize";
import { config } from "../config";
import { logDebug } from "../utils/logger";

const db: Sequelize = new Sequelize(config.PG_CONNECTION_STRING!, {
  dialect: "postgres",
  benchmark: true,
  logging: config.PG_LOGGING
    ? (sql, timing) => {
        logDebug("[DB] Execution", {
          Timing: `${timing?.toString()}ms`,
          Sql: sql,
        });
      }
    : false,
} as Options);

export default db;

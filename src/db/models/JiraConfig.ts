import { DataTypes, InferAttributes, Model, Sequelize } from "sequelize";
import { InputValidator } from "../../services/InputValidator";
import { ServiceContainer } from "../../services/ServiceContainer";

export class JiraConfig extends Model<InferAttributes<JiraConfig>> {
  declare guildId: string;
  declare host: string;
  declare username: string;
  declare token: string;
  declare userId: string;
  declare timeJqlOverride?: string;
  declare schedulePaused: boolean;
  declare dailyHours?: number;

  static initModel(sequelize: Sequelize): typeof JiraConfig {
    JiraConfig.init(
      {
        guildId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        host: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        username: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        token: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        userId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        timeJqlOverride: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        schedulePaused: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        dailyHours: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 8,
        },
      },
      {
        sequelize,
        hooks: {
          beforeValidate: (instance: JiraConfig) => {
            // Validate host
            if (instance.host) {
              instance.host = InputValidator.validateJiraHost(instance.host);
            }

            // Validate username (email)
            if (instance.username) {
              instance.username = InputValidator.validateEmail(
                instance.username
              );
            }

            // Validate API token
            if (instance.token) {
              instance.token = InputValidator.validateApiToken(instance.token);
            }

            // Validate Discord IDs
            if (instance.userId) {
              InputValidator.validateDiscordId(instance.userId, "User ID");
            }

            if (instance.guildId) {
              InputValidator.validateDiscordId(instance.guildId, "Guild ID");
            }

            // Validate JQL if provided
            if (instance.timeJqlOverride) {
              instance.timeJqlOverride = InputValidator.validateJQL(
                instance.timeJqlOverride
              );
            }

            // Validate daily hours
            if (instance.dailyHours !== undefined) {
              instance.dailyHours = InputValidator.validateDailyHours(
                instance.dailyHours
              );
            }
          },
          beforeCreate: (instance: JiraConfig) => {
            // Encrypt the token before storing in database
            if (instance.token) {
              const encryptionService = ServiceContainer.getEncryptionService();
              instance.token = encryptionService.encrypt(instance.token);
            }
          },
          beforeUpdate: (instance: JiraConfig) => {
            // Encrypt the token before updating in database
            if (instance.token && instance.changed("token")) {
              const encryptionService = ServiceContainer.getEncryptionService();
              instance.token = encryptionService.encrypt(instance.token);
            }
          },
          afterFind: (instances: JiraConfig | JiraConfig[] | null) => {
            // Decrypt tokens after reading from database
            if (!instances) return;

            const configs = Array.isArray(instances) ? instances : [instances];
            const encryptionService = ServiceContainer.getEncryptionService();

            for (const config of configs) {
              if (config.token) {
                try {
                  config.token = encryptionService.decrypt(config.token);
                } catch (error) {
                  // If decryption fails, the token might be stored in plain text (legacy)
                  // Log a warning but don't fail - this allows migration
                  console.warn(
                    `Failed to decrypt token for user ${config.userId}:`,
                    error
                  );
                }
              }
            }
          },
        },
      }
    );

    return JiraConfig;
  }
}

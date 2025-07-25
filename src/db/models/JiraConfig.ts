import { DataTypes, InferAttributes, Model, Sequelize } from "sequelize";

export class JiraConfig extends Model<InferAttributes<JiraConfig>> {
  declare guildId: string;
  declare host: string;
  declare username: string;
  declare token: string;
  declare userId: string;
  declare timeJqlOverride?: string;
  declare schedulePaused: boolean;

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
      },
      {
        sequelize,
      }
    );

    return JiraConfig;
  }
}

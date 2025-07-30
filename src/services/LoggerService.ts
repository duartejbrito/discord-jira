/* eslint-disable @typescript-eslint/no-explicit-any */
import { blue, magenta, red, yellow } from "colors/safe";
import {
  ColorResolvable,
  Colors,
  EmbedBuilder,
  SendableChannels,
} from "discord.js";

/* eslint-disable no-unused-vars */
export enum LogType {
  INFO,
  WARN,
  ERROR,
  DEBUG,
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
    client: unknown,
    ownerLogChannelId: string,
    discordLogging?: boolean
  ): void;

  // Backward compatibility methods (legacy interface)
  logInfo(message: string, args?: Record<string, unknown>): void;
  logWarn(message: string, args?: Record<string, unknown>): void;
  logDebug(message: string, args?: Record<string, unknown>): void;
  logError(message: string | Error, args?: Record<string, unknown>): void;
}
/* eslint-enable no-unused-vars */

export class LoggerService implements ILoggerService {
  private static instance: ILoggerService;
  private logChannel: SendableChannels | null = null;
  private client: any = null;
  private discordLogging = false;
  private ownerLogChannelId: string | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): ILoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  /**
   * Initialize the logger with Discord client and configuration
   */
  initialize(
    client: any,
    ownerLogChannelId: string,
    discordLogging = false
  ): void {
    this.client = client;
    this.ownerLogChannelId = ownerLogChannelId;
    this.discordLogging = discordLogging;

    if (client && ownerLogChannelId) {
      this.logChannel = client.channels.cache.get(
        ownerLogChannelId
      ) as SendableChannels;
    }
  }

  private async logDiscord(
    message: string,
    args: Record<string, any> = {},
    color: ColorResolvable = Colors.Blue
  ): Promise<void> {
    if (!this.logChannel || !this.client) return;

    const embed = new EmbedBuilder();
    embed.setColor(color);
    embed.setTitle(message);
    embed.setFooter({
      text: this.client.user!.tag,
      iconURL: this.client.user!.displayAvatarURL(),
    });
    embed.setTimestamp();

    if (args && Object.keys(args).length > 0) {
      const fields = Object.keys(args).map((key) => {
        return {
          name: key,
          value: args[key] ? JSON.stringify(args[key]) : " ",
          inline: true,
        };
      });
      embed.addFields(fields);
    }

    const logMessage = this.logChannel.send({
      embeds: [embed],
    });

    // Auto delete message after 30 seconds FOR DEVELOPMENT PURPOSES
    // await logMessage.then(async (message) => {
    //   setTimeout(async () => {
    //     message.delete();
    //   }, 30000);
    // });

    await logMessage;
  }

  private log(
    message: string,
    type: LogType = LogType.INFO,
    args: Record<string, any> = {}
  ): void {
    const now = new Date().toISOString();
    let discordColor: ColorResolvable = Colors.Blue;
    // eslint-disable-next-line no-unused-vars
    let colorSafe: (str: string) => string;

    switch (type) {
      case LogType.INFO:
        colorSafe = blue;
        discordColor = Colors.Blue;
        break;
      case LogType.WARN:
        colorSafe = yellow;
        discordColor = Colors.Yellow;
        break;
      case LogType.ERROR:
        colorSafe = red;
        discordColor = Colors.Red;
        break;
      case LogType.DEBUG:
        colorSafe = magenta;
        discordColor = Colors.Blurple;
        break;
    }

    let logMessage = `${now}: ${colorSafe(`[${LogType[type]}]`)} ${message}`;
    if (Object.keys(args).length > 0) {
      logMessage += ` ${yellow(JSON.stringify(args))}`;
    }

    console.log(logMessage);

    if (this.discordLogging) {
      this.logDiscord(message, args, discordColor);
    }
  }

  // ILoggerService interface implementation
  info(message: string, details: Record<string, any> = {}): void {
    this.log(message, LogType.INFO, details);
  }

  warn(message: string, details: Record<string, any> = {}): void {
    this.log(message, LogType.WARN, details);
  }

  debug(message: string, details: Record<string, any> = {}): void {
    this.log(message, LogType.DEBUG, details);
  }

  error(error: Error | string, details: Record<string, any> = {}): void {
    const message = error instanceof Error ? error.message : error;
    this.log(message, LogType.ERROR, details);
  }

  // Backward compatibility methods (legacy interface)
  logInfo = (message: string, args: Record<string, any> = {}): void =>
    this.log(message, LogType.INFO, args);

  logWarn = (message: string, args: Record<string, any> = {}): void =>
    this.log(message, LogType.WARN, args);

  logDebug = (message: string, args: Record<string, any> = {}): void =>
    this.log(message, LogType.DEBUG, args);

  logError = (message: string | Error, args: Record<string, any> = {}): void =>
    this.log(
      message instanceof Error ? message.message : message,
      LogType.ERROR,
      args
    );
}

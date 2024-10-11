/* eslint-disable @typescript-eslint/no-explicit-any */
import { blue, magenta, red, yellow } from "colors/safe";
import {
  ColorResolvable,
  Colors,
  EmbedBuilder,
  SendableChannels,
} from "discord.js";
import { client } from "..";
import { config } from "../config";

const { OWNER_LOG_CHANNEL_ID, DISCORD_LOGGING } = config;
let logChannel: SendableChannels;

export function initLogger() {
  if (client) {
    logChannel = client.channels.cache.get(
      OWNER_LOG_CHANNEL_ID!
    ) as SendableChannels;
  }
}

export enum Type {
  /* eslint-disable no-unused-vars */
  INFO,
  WARN,
  ERROR,
  DEBUG,
  /* eslint-enable no-unused-vars */
}

async function logDiscord(
  message: string,
  args: Record<string, any> = {},
  color: ColorResolvable = Colors.Blue
): Promise<void> {
  if (!logChannel) return;

  const embed = new EmbedBuilder();
  embed.setColor(color);
  embed.setTitle(message);
  embed.setFooter({
    text: client.user!.tag,
    iconURL: client.user!.displayAvatarURL(),
  });
  embed.setTimestamp();

  if (args) {
    const fields = Object.keys(args).map((key) => {
      return {
        name: key,
        value: args[key] ? JSON.stringify(args[key]) : " ",
        inline: true,
      };
    });
    embed.addFields(fields);
  }

  const logMessage = logChannel.send({
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

function log(
  message: string,
  type: Type = Type.INFO,
  args: Record<string, any> = {}
) {
  const now = new Date().toISOString();
  let discordColor: ColorResolvable = Colors.Blue;
  // eslint-disable-next-line no-unused-vars
  let colorSafe: (str: string) => string;

  switch (type) {
    case Type.INFO:
      colorSafe = blue;
      discordColor = Colors.Blue;
      break;
    case Type.WARN:
      colorSafe = yellow;
      discordColor = Colors.Yellow;
      break;
    case Type.ERROR:
      colorSafe = red;
      discordColor = Colors.Red;
      break;
    case Type.DEBUG:
      colorSafe = magenta;
      discordColor = Colors.Blurple;
      break;
  }

  let logMessage = `${now}: ${colorSafe(`[${Type[type]}]`)} ${message}`;
  if (Object.keys(args).length > 0) {
    logMessage += ` ${yellow(JSON.stringify(args))}`;
  }

  console.log(logMessage);

  if (DISCORD_LOGGING) {
    logDiscord(message, args, discordColor);
  }
}

export const logInfo = (message: string, args: Record<string, any> = {}) =>
  log(message, Type.INFO, args);
export const logWarn = (message: string, args: Record<string, any> = {}) =>
  log(message, Type.WARN, args);
export const logDebug = (message: string, args: Record<string, any> = {}) =>
  log(message, Type.DEBUG, args);
export const logError = (
  message: string | Error,
  args: Record<string, any> = {}
) =>
  log(message instanceof Error ? message.message : message, Type.ERROR, args);

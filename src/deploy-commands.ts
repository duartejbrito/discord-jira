import { REST, Routes } from "discord.js";
import { commandsData, ownerCommandsData } from "./commands";
import { config } from "./config";
import { logError, logInfo } from "./utils/logger";

const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);

export async function deployCommands() {
  try {
    await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), {
      body: commandsData,
    });

    logInfo("Commands deployed", {
      Commands: commandsData.map((d) => `/${d.name}`).join("\n"),
    });
  } catch (error) {
    logError(error as Error);
  }
}

export async function deployGuildCommands() {
  try {
    await rest.put(
      Routes.applicationGuildCommands(
        config.DISCORD_CLIENT_ID,
        config.OWNER_GUILD_ID!
      ),
      {
        body: ownerCommandsData,
      }
    );

    logInfo("Commands deployed", {
      GuildId: config.OWNER_GUILD_ID!,
      Commands: ownerCommandsData.map((d) => `/${d.name}`).join("\n"),
    });
  } catch (error) {
    logError(error as Error);
  }
}

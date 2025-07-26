import { REST, Routes } from "discord.js";
import { commandsData, ownerCommandsData } from "./commands";
import { config } from "./config";
import { LoggerService } from "./services/LoggerService";
import { ServiceContainer } from "./services/ServiceContainer";

const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);

export async function deployCommands() {
  try {
    await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), {
      body: commandsData,
    });

    const container = ServiceContainer.getInstance();
    const loggerService = container.get<LoggerService>("LoggerService");
    loggerService.logInfo("Commands deployed", {
      Commands: commandsData.map((d) => `/${d.name}`).join("\n"),
    });
  } catch (error) {
    const container = ServiceContainer.getInstance();
    const loggerService = container.get<LoggerService>("LoggerService");
    loggerService.logError(error as Error);
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

    const container = ServiceContainer.getInstance();
    const loggerService = container.get<LoggerService>("LoggerService");
    loggerService.logInfo("Commands deployed", {
      GuildId: config.OWNER_GUILD_ID!,
      Commands: ownerCommandsData.map((d) => `/${d.name}`).join("\n"),
    });
  } catch (error) {
    const container = ServiceContainer.getInstance();
    const loggerService = container.get<LoggerService>("LoggerService");
    loggerService.logError(error as Error);
  }
}

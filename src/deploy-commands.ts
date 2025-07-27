import { REST, Routes } from "discord.js";
import { commandsData, ownerCommandsData } from "./commands";
import { IConfigService, ILoggerService } from "./services/interfaces";
import { ServiceContainer } from "./services/ServiceContainer";

// Function to get initialized services
function getServices() {
  ServiceContainer.initializeServices();
  const container = ServiceContainer.getInstance();
  const configService = container.get<IConfigService>("IConfigService");
  return { container, configService };
}

// Initialize REST client
function getRestClient(): REST {
  const { configService } = getServices();
  return new REST({ version: "10" }).setToken(configService.getDiscordToken());
}

export async function deployCommands() {
  try {
    const { configService } = getServices();
    const rest = getRestClient();

    await rest.put(
      Routes.applicationCommands(configService.getDiscordClientId()),
      {
        body: commandsData,
      }
    );

    const container = ServiceContainer.getInstance();
    const loggerService = container.get<ILoggerService>("ILoggerService");
    loggerService.logInfo("Commands deployed", {
      Commands: commandsData.map((d) => `/${d.name}`).join("\n"),
    });
  } catch (error) {
    const container = ServiceContainer.getInstance();
    const loggerService = container.get<ILoggerService>("ILoggerService");
    loggerService.logError(error as Error);
  }
}

export async function deployGuildCommands() {
  try {
    const { configService } = getServices();
    const rest = getRestClient();

    await rest.put(
      Routes.applicationGuildCommands(
        configService.getDiscordClientId(),
        configService.getOwnerGuildId()!
      ),
      {
        body: ownerCommandsData,
      }
    );

    const container = ServiceContainer.getInstance();
    const loggerService = container.get<ILoggerService>("ILoggerService");
    loggerService.logInfo("Commands deployed", {
      GuildId: configService.getOwnerGuildId()!,
      Commands: ownerCommandsData.map((d) => `/${d.name}`).join("\n"),
    });
  } catch (error) {
    const container = ServiceContainer.getInstance();
    const loggerService = container.get<ILoggerService>("ILoggerService");
    loggerService.logError(error as Error);
  }
}

import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import { allCommands } from "./commands";
import { initModels } from "./db/models";
import { deployCommands, deployGuildCommands } from "./deploy-commands";
import { initScheduledJobs } from "./scheduler";
import { IConfigService } from "./services/ConfigService";
import { ErrorHandler } from "./services/ErrorHandler";
import { ILoggerService } from "./services/LoggerService";
import { ServiceContainer } from "./services/ServiceContainer";

export const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, async () => {
  // Initialize services
  const container = ServiceContainer.initializeServices();
  const loggerService = container.get<ILoggerService>("ILoggerService");
  const configService = container.get<IConfigService>("IConfigService");

  // Initialize logger with Discord client
  loggerService.initialize(
    client,
    configService.getOwnerLogChannelId()!,
    configService.isDiscordLoggingEnabled()
  );

  // Keep the old initLogger for backward compatibility (now it's a no-op)
  // initLogger() is no longer needed as service initialization handles it

  loggerService.logInfo("Discord bot is ready! 🤖", {
    DisplayName: client.user!.displayName,
    Tag: client.user!.tag,
  });
  await initModels();
  initScheduledJobs();
});

client.on(Events.GuildCreate, async (guild) => {
  const container = ServiceContainer.getInstance();
  const configService = container.get<IConfigService>("IConfigService");

  if (guild.id === configService.getOwnerGuildId()) {
    await deployCommands();
    await deployGuildCommands();
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const { commandName } = interaction;
  if (allCommands[commandName as keyof typeof allCommands]) {
    try {
      await allCommands[commandName as keyof typeof allCommands].execute(
        interaction
      );
    } catch (error) {
      const container = ServiceContainer.getInstance();
      const logger = container.get<ILoggerService>("ILoggerService");

      // Use centralized error handling
      await ErrorHandler.handleCommandError(
        interaction,
        error instanceof Error ? error : new Error(String(error)),
        logger
      );
    }
  } else {
    const container = ServiceContainer.getInstance();
    const logger = container.get<ILoggerService>("ILoggerService");

    logger.warn("Unknown command attempted", {
      commandName: interaction.commandName,
      guildId: interaction.guildId,
      userId: interaction.user.id,
    });

    await interaction.reply({
      content: "❌ Unknown command.",
      flags: MessageFlags.Ephemeral,
    });
  }
});

// Initialize config service and login
function initializeAndLogin() {
  const container = ServiceContainer.initializeServices();
  const configService = container.get<IConfigService>("IConfigService");
  return client.login(configService.getDiscordToken());
}

initializeAndLogin();

import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import { allCommands } from "./commands";
import { config } from "./config";
import { initModels } from "./db/models";
import { deployCommands, deployGuildCommands } from "./deploy-commands";
import { initScheduledJobs } from "./scheduler";
import { ILoggerService } from "./services/interfaces";
import { ServiceContainer } from "./services/ServiceContainer";

export const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, async () => {
  // Initialize services
  const container = ServiceContainer.initializeServices();
  const loggerService = container.get<ILoggerService>("ILoggerService");

  // Initialize logger with Discord client
  loggerService.initialize(
    client,
    config.OWNER_LOG_CHANNEL_ID!,
    config.DISCORD_LOGGING
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
  if (guild.id === config.OWNER_GUILD_ID) {
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
      const loggerService = container.get<ILoggerService>("ILoggerService");
      loggerService.logError(error as Error);
      const errorMessage = "There was an error while executing this command!";
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: errorMessage,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          content: errorMessage,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  }
});

client.login(config.DISCORD_TOKEN);

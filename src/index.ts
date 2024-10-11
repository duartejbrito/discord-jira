import { Client, Events, GatewayIntentBits } from "discord.js";
import { allCommands } from "./commands";
import { config } from "./config";
import { deployCommands, deployGuildCommands } from "./deploy-commands";
import { logInfo, logError, initLogger } from "./utils/logger";

export const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, async () => {
  initLogger();
  logInfo("Discord bot is ready! 🤖", {
    DisplayName: client.user!.displayName,
    Tag: client.user!.tag,
  });
});

client.on(Events.GuildCreate, async (guild) => {
  if (guild.id === config.OWNER_GUILD_ID) {
    await deployCommands();
    await deployGuildCommands();
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) {
    return;
  }

  const { commandName } = interaction;
  if (allCommands[commandName as keyof typeof allCommands]) {
    try {
      await allCommands[commandName as keyof typeof allCommands].execute(
        interaction
      );
    } catch (error) {
      logError(error as Error);
      const errorMessage = "There was an error while executing this command!";
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  }
});

client.login(config.DISCORD_TOKEN);

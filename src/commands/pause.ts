import {
  CommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import { JiraConfig } from "../db/models";
import { logInfo } from "../utils/logger";

export const name = "pause";

export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription("Pause the execution of scheduled jobs.")
  .setContexts([InteractionContextType.Guild]);

export async function execute(interaction: CommandInteraction) {
  logInfo("Pause command executed", { GuildId: interaction.guildId! });

  const config = await JiraConfig.findOne({
    where: { guildId: interaction.guildId!, userId: interaction.user.id },
  });

  if (config) {
    await config.update({ schedulePaused: !config.schedulePaused });

    return interaction.reply({
      content: `Scheduled jobs have been ${
        config?.schedulePaused ? "paused" : "resumed"
      }.`,
      ephemeral: true,
    });
  } else {
    return interaction.reply({
      content: "No Jira configuration found for this user.",
      ephemeral: true,
    });
  }
}

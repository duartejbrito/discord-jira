import {
  CommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { JiraConfig } from "../db/models";
import { ILoggerService } from "../services/interfaces";
import { ServiceContainer } from "../services/ServiceContainer";

export const name = "pause";

export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription("Pause the execution of scheduled jobs.")
  .setContexts([InteractionContextType.Guild]);

export async function execute(interaction: CommandInteraction) {
  const container = ServiceContainer.getInstance();
  const loggerService = container.get<ILoggerService>("ILoggerService");

  loggerService.logInfo("Executing pause command", {
    GuildId: interaction.guildId,
    UserId: interaction.user.id,
  });

  const config = await JiraConfig.findOne({
    where: { guildId: interaction.guildId!, userId: interaction.user.id },
  });

  if (config) {
    await config.update({ schedulePaused: !config.schedulePaused });

    return interaction.reply({
      content: `Scheduled jobs have been ${
        config?.schedulePaused ? "paused" : "resumed"
      }.`,
      flags: MessageFlags.Ephemeral,
    });
  } else {
    return interaction.reply({
      content: "No Jira configuration found for this user.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

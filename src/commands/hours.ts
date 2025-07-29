import {
  ChatInputCommandInteraction,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { JiraConfig } from "../db/models/JiraConfig";
import { ILoggerService } from "../services/interfaces";
import { ServiceContainer } from "../services/ServiceContainer";

export const name = "hours";

export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription("Configure your daily hours for time logging.")
  .setContexts([InteractionContextType.Guild])
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
  .addIntegerOption((option) =>
    option
      .setName("hours")
      .setDescription("The number of daily hours to distribute across tickets.")
      .setMinValue(1)
      .setMaxValue(24)
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const container = ServiceContainer.getInstance();
  const loggerService = container.get<ILoggerService>("ILoggerService");

  loggerService.logInfo("Executing hours command", {
    GuildId: interaction.guildId,
    UserId: interaction.user.id,
  });

  const hours = interaction.options.get("hours", true).value as number;

  const config = await JiraConfig.findOne({
    where: { guildId: interaction.guildId!, userId: interaction.user.id },
  });

  if (!config) {
    return interaction.reply({
      content:
        "No Jira configuration found for this user. Please run `/setup` first.",
      flags: MessageFlags.Ephemeral,
    });
  }

  config.dailyHours = hours;
  await config.save();

  return interaction.reply({
    content: `Your daily hours have been updated to ${hours} hours. This will be used for automatic time distribution in scheduled jobs and the /time command when hours are not specified.`,
    flags: MessageFlags.Ephemeral,
  });
}

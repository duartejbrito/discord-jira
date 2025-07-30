import {
  ChatInputCommandInteraction,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { JiraConfig } from "../db/models/JiraConfig";
import { ErrorHandler } from "../services/ErrorHandler";
import { InputValidator } from "../services/InputValidator";
import { ILoggerService } from "../services/LoggerService";
import { IRateLimitService } from "../services/RateLimitService";
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
  try {
    const container = ServiceContainer.getInstance();
    const loggerService = container.get<ILoggerService>("ILoggerService");
    const rateLimitService =
      container.get<IRateLimitService>("IRateLimitService");

    // Check rate limit for hours command
    try {
      rateLimitService.checkRateLimit(interaction.user.id, "hours");
    } catch (error) {
      return interaction.reply({
        content: `⏱️ **Rate Limited**: ${
          error instanceof Error ? error.message : "Please try again later."
        }`,
        flags: MessageFlags.Ephemeral,
      });
    }

    loggerService.logInfo("Executing hours command", {
      GuildId: interaction.guildId,
      UserId: interaction.user.id,
    });

    const hours = interaction.options.get("hours", true).value as number;

    // Validate input
    try {
      // Validate Discord IDs
      InputValidator.validateDiscordId(interaction.user.id, "User ID");
      if (interaction.guildId) {
        InputValidator.validateDiscordId(interaction.guildId, "Guild ID");
      }

      InputValidator.validateNumber(hours, "hours", {
        min: 1,
        max: 24,
        integer: true,
      });
    } catch (error) {
      return interaction.reply({
        content: "Hours must be between 1 and 24.",
        flags: MessageFlags.Ephemeral,
      });
    }

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
  } catch (error) {
    await ErrorHandler.handleCommandError(interaction, error as Error);
  }
}

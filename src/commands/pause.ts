import {
  CommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { JiraConfig } from "../db/models";
import { ErrorHandler } from "../services/ErrorHandler";
import { InputValidator } from "../services/InputValidator";
import { ILoggerService } from "../services/LoggerService";
import { IRateLimitService } from "../services/RateLimitService";
import { ServiceContainer } from "../services/ServiceContainer";

export const name = "pause";

export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription("Pause the execution of scheduled jobs.")
  .setContexts([InteractionContextType.Guild]);

export async function execute(interaction: CommandInteraction) {
  try {
    const container = ServiceContainer.getInstance();
    const loggerService = container.get<ILoggerService>("ILoggerService");
    const rateLimitService =
      container.get<IRateLimitService>("IRateLimitService");

    // Validate Discord IDs
    try {
      InputValidator.validateDiscordId(interaction.user.id, "User ID");
      if (interaction.guildId) {
        InputValidator.validateDiscordId(interaction.guildId, "Guild ID");
      }
    } catch (error) {
      return interaction.reply({
        content: "Invalid Discord ID format.",
        flags: MessageFlags.Ephemeral,
      });
    }

    // Check rate limits
    try {
      rateLimitService.checkRateLimit(interaction.user.id, "pause");
    } catch (rateLimitError) {
      const errorMessage =
        rateLimitError instanceof Error
          ? rateLimitError.message
          : "Rate limit exceeded";
      return interaction.reply({
        content: `Rate limit exceeded: ${errorMessage}`,
        flags: MessageFlags.Ephemeral,
      });
    }

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
  } catch (error) {
    await ErrorHandler.handleCommandError(interaction, error as Error);
  }
}

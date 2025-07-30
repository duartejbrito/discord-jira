import {
  CommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { JiraConfig } from "../db/models/JiraConfig";
import { ErrorHandler } from "../services/ErrorHandler";
import { InputValidator } from "../services/InputValidator";
import { ILoggerService } from "../services/LoggerService";
import { IRateLimitService } from "../services/RateLimitService";
import { ServiceContainer } from "../services/ServiceContainer";

export const name = "info";

export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription("Show your Jira configuration information.")
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
      rateLimitService.checkRateLimit(interaction.user.id, "info");
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

    loggerService.logInfo("Executing info command", {
      GuildId: interaction.guildId,
      UserId: interaction.user.id,
    });

    const config = await JiraConfig.findOne({
      where: { guildId: interaction.guildId!, userId: interaction.user.id },
    });

    if (config) {
      return interaction.reply({
        content: `Here is your Jira configuration information:
- Host: ${InputValidator.sanitizeInput(config.host)}
- Username: ${InputValidator.sanitizeInput(config.username)}
- Jira API Token: ${config.token.substring(0, 8)}...***
- Time JQL Override: ${
          config.timeJqlOverride
            ? InputValidator.sanitizeInput(config.timeJqlOverride)
            : "None"
        }
- Schedule Paused: ${config.schedulePaused ? "Yes" : "No"}
- Daily Hours: ${config.dailyHours || 8} hours`,
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

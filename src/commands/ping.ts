import {
  CommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { ErrorHandler } from "../services/ErrorHandler";
import { InputValidator } from "../services/InputValidator";
import { ILoggerService } from "../services/LoggerService";
import { ServiceContainer } from "../services/ServiceContainer";

export const name = "ping";

export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription("Replies with Pong!")
  .setContexts([InteractionContextType.Guild]);

export async function execute(interaction: CommandInteraction) {
  try {
    const container = ServiceContainer.getInstance();
    const loggerService = container.get<ILoggerService>("ILoggerService");

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

    loggerService.logInfo("Executing ping command", {
      GuildId: interaction.guildId,
      UserId: interaction.user.id,
    });

    return interaction.reply({
      content: "Pong!",
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    await ErrorHandler.handleCommandError(interaction, error as Error);
  }
}

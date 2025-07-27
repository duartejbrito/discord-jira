import {
  CommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { ILoggerService } from "../services/interfaces";
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

    loggerService.logInfo("Executing ping command", {
      GuildId: interaction.guildId,
      UserId: interaction.user.id,
    });

    return interaction.reply({
      content: "Pong!",
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error("Ping command error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return interaction.reply({
      content: `❌ Error: ${errorMessage}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

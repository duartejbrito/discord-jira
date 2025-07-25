import {
  CommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { logInfo } from "../utils/logger";

export const name = "ping";

export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription("Replies with Pong!")
  .setContexts([InteractionContextType.Guild]);

export async function execute(interaction: CommandInteraction) {
  logInfo("Ping command executed", { GuildId: interaction.guildId! });
  return interaction.reply({ content: "Pong!", flags: MessageFlags.Ephemeral });
}

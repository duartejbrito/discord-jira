import {
  CommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
  MessageFlags,
  EmbedBuilder,
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
      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Invalid Input")
        .setDescription("Invalid Discord ID format.")
        .setColor(0xff0000)
        .setTimestamp();

      return interaction.reply({
        embeds: [errorEmbed],
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

      const rateLimitEmbed = new EmbedBuilder()
        .setTitle("⏱️ Rate Limited")
        .setDescription(`${errorMessage}`)
        .setColor(0xffaa00)
        .setTimestamp();

      return interaction.reply({
        embeds: [rateLimitEmbed],
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
      const newPausedState = !config.schedulePaused;
      await config.update({ schedulePaused: newPausedState });

      const isPaused = newPausedState;
      const embed = new EmbedBuilder()
        .setTitle(
          isPaused ? "⏸️ Scheduled Jobs Paused" : "▶️ Scheduled Jobs Resumed"
        )
        .setDescription(
          isPaused
            ? "Automatic time logging has been **paused**. You can still manually track time using `/time`."
            : "Automatic time logging has been **resumed**. The bot will continue tracking your work."
        )
        .setColor(isPaused ? 0xffaa00 : 0x00ff00)
        .addFields([
          {
            name: "📊 Status",
            value: isPaused ? "🔴 Paused" : "🟢 Active",
            inline: true,
          },
          {
            name: "🔄 Toggle Again",
            value: `Use \`/pause\` to ${
              isPaused ? "resume" : "pause"
            } automatic logging.`,
            inline: true,
          },
        ])
        .setTimestamp()
        .setFooter({
          text: `${isPaused ? "Paused" : "Resumed"} by ${
            interaction.user.username
          }`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      return interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    } else {
      const errorEmbed = new EmbedBuilder()
        .setTitle("⚠️ Configuration Not Found")
        .setDescription("No Jira configuration found for this user.")
        .addFields([
          {
            name: "🔧 Next Step",
            value:
              "Please run `/setup` first to configure your Jira connection.",
            inline: false,
          },
        ])
        .setColor(0xffaa00)
        .setTimestamp();

      return interaction.reply({
        embeds: [errorEmbed],
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    await ErrorHandler.handleCommandError(interaction, error as Error);
  }
}

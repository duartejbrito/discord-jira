import {
  CommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
  MessageFlags,
  EmbedBuilder,
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
      rateLimitService.checkRateLimit(interaction.user.id, "info");
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

    loggerService.logInfo("Executing info command", {
      GuildId: interaction.guildId,
      UserId: interaction.user.id,
    });

    const config = await JiraConfig.findOne({
      where: { guildId: interaction.guildId!, userId: interaction.user.id },
    });

    if (config) {
      const embed = new EmbedBuilder()
        .setTitle("📋 Your Jira Configuration")
        .setDescription("Here are your current Jira integration settings:")
        .setColor(0x0099ff)
        .addFields([
          {
            name: "🌐 Host",
            value: `\`${InputValidator.sanitizeInput(config.host)}\``,
            inline: true,
          },
          {
            name: "👤 Username",
            value: `\`${InputValidator.sanitizeInput(config.username)}\``,
            inline: true,
          },
          {
            name: "🔑 API Token",
            value: `\`${config.token.substring(0, 8)}...***\``,
            inline: true,
          },
          {
            name: "📊 Daily Hours",
            value: `\`${config.dailyHours || 8} hours\``,
            inline: true,
          },
          {
            name: "⏸️ Schedule Status",
            value: config.schedulePaused ? "🔴 Paused" : "🟢 Active",
            inline: true,
          },
          {
            name: "🔍 Time JQL Override",
            value: config.timeJqlOverride
              ? `\`${InputValidator.sanitizeInput(config.timeJqlOverride)}\``
              : "`None`",
            inline: false,
          },
        ])
        .setTimestamp()
        .setFooter({
          text: `Configuration for ${interaction.user.username}`,
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

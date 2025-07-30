import {
  ChatInputCommandInteraction,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { JiraConfig } from "../db/models";
import {
  ApplicationError,
  ErrorHandler,
  ErrorType,
} from "../services/ErrorHandler";
import { InputValidator } from "../services/InputValidator";
import { IJiraService } from "../services/JiraService";
import { ILoggerService } from "../services/LoggerService";
import { IRateLimitService } from "../services/RateLimitService";
import { ServiceContainer } from "../services/ServiceContainer";

export const name = "setup";

export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription("Setup a Jira configuration for your user.")
  .setContexts([InteractionContextType.Guild])
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
  .addStringOption((option) =>
    option
      .setName("host")
      .setDescription("The host of your Jira instance.")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("username")
      .setDescription("Your Jira username.")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("token")
      .setDescription("Your Jira API token.")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("jql")
      .setDescription("The JQL query to use for searching.")
      .setRequired(false)
  )
  .addIntegerOption((option) =>
    option
      .setName("daily-hours")
      .setDescription("Daily hours to distribute across tickets (default: 8).")
      .setMinValue(1)
      .setMaxValue(24)
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const serviceContainer = ServiceContainer.getInstance();
    const jiraService = serviceContainer.get<IJiraService>("IJiraService");
    const logger = serviceContainer.get<ILoggerService>("ILoggerService");
    const rateLimitService =
      serviceContainer.get<IRateLimitService>("IRateLimitService");

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Check rate limit for setup command
    try {
      rateLimitService.checkRateLimit(interaction.user.id, "setup");
    } catch (error) {
      await interaction.editReply({
        content: `⏱️ **Rate Limited**: ${
          error instanceof Error ? error.message : "Please try again later."
        }`,
      });
      return;
    }

    const host = interaction.options.get("host", true);
    const username = interaction.options.get("username", true);
    const token = interaction.options.get("token", true);
    const jql = interaction.options.get("jql", false);
    const dailyHours =
      (interaction.options.get("daily-hours", false)?.value as number) ?? 8;

    logger.info("Executing setup command", {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      host: host.value,
    });

    // Validate inputs using InputValidator
    let validatedHost: string;
    let validatedUsername: string;
    let validatedToken: string;
    let validatedJql: string | undefined;
    let validatedDailyHours: number;

    try {
      // Validate Discord IDs
      InputValidator.validateDiscordId(interaction.user.id, "User ID");
      if (interaction.guildId) {
        InputValidator.validateDiscordId(interaction.guildId, "Guild ID");
      }

      validatedHost = InputValidator.validateJiraHost(host.value as string);
      validatedUsername = InputValidator.validateEmail(
        username.value as string
      );
      validatedToken = InputValidator.validateApiToken(token.value as string);
      validatedJql = InputValidator.validateJQL(jql?.value as string);
      validatedDailyHours = InputValidator.validateDailyHours(dailyHours);
    } catch (error) {
      if (error instanceof Error) {
        await interaction.editReply({
          content: `❌ **Validation Error**: ${InputValidator.sanitizeInput(
            error.message
          )}`,
        });
        return;
      }
      throw error;
    }

    // Test Jira connection
    try {
      await jiraService.getServerInfo(
        validatedHost,
        validatedUsername,
        validatedToken
      );
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }
      throw new ApplicationError(
        "Failed to validate Jira connection",
        ErrorType.JIRA_API_ERROR,
        true,
        undefined,
        {
          originalError: error instanceof Error ? error.message : String(error),
        }
      );
    }

    // Save configuration to database
    const [config, created] = await JiraConfig.findOrCreate({
      where: {
        guildId: interaction.guildId!,
        userId: interaction.user.id,
      },
      defaults: {
        guildId: interaction.guildId!,
        host: validatedHost,
        username: validatedUsername,
        token: validatedToken,
        userId: interaction.user.id,
        timeJqlOverride: validatedJql,
        schedulePaused: false,
        dailyHours: validatedDailyHours,
      },
    });

    if (!created) {
      config.host = validatedHost;
      config.username = validatedUsername;
      config.token = validatedToken;
      config.timeJqlOverride = validatedJql;
      config.dailyHours = validatedDailyHours;
      await config.save();
    }

    logger.info("Jira configuration saved successfully", {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      created,
    });

    await interaction.followUp({
      content: "✅ Your Jira configuration has been saved successfully!",
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    await ErrorHandler.handleCommandError(
      interaction,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  InteractionContextType,
  InteractionReplyOptions,
  InteractionEditReplyOptions,
  MessageComponentInteraction,
  MessagePayload,
  PermissionFlagsBits,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import "../services/utils"; // Import to initialize String.prototype.format extension
import { JiraConfig } from "../db/models";
import { PageOfWorklogs, SearchResults } from "../jira/models";
import { ErrorHandler } from "../services/ErrorHandler";
import { InputValidator } from "../services/InputValidator";
import { IJiraService } from "../services/JiraService";
import { IRateLimitService } from "../services/RateLimitService";
import { ServiceContainer } from "../services/ServiceContainer";
import { TimeUtils } from "../services/TimeUtils";

export const name = "time";

export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription("Check your work and log time.")
  .setContexts([InteractionContextType.Guild])
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
  .addIntegerOption((option) =>
    option
      .setName("days-ago")
      .setDescription("The number of days ago to check your work.")
      .setMinValue(1)
      .setMaxValue(50)
      .setRequired(true)
  )
  .addIntegerOption((option) =>
    option
      .setName("hours")
      .setDescription("The number of hours to log.")
      .setMinValue(1)
      .setMaxValue(24)
      .setRequired(false)
  );

function replyOrFollowUp(
  interaction: ChatInputCommandInteraction,
  options: string | MessagePayload | InteractionReplyOptions
) {
  if (interaction.replied) {
    return interaction.followUp(options);
  }
  if (interaction.deferred) {
    // Currently behaves the same but could change in the future
    return interaction.editReply(
      options as string | MessagePayload | InteractionEditReplyOptions
    );
  }
  return interaction.reply(options);
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const container = ServiceContainer.getInstance();
    const rateLimitService =
      container.get<IRateLimitService>("IRateLimitService");

    // Check rate limit for time command (more restrictive since it makes multiple API calls)
    try {
      rateLimitService.checkRateLimit(interaction.user.id, "time");
    } catch (error) {
      await replyOrFollowUp(interaction, {
        content: `⏱️ **Rate Limited**: ${
          error instanceof Error ? error.message : "Please try again later."
        }`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const daysAgo = interaction.options.get("days-ago", true);
    const hours = interaction.options.get("hours", false)?.value as number;

    // Validate inputs
    try {
      // Validate Discord IDs
      InputValidator.validateDiscordId(interaction.user.id, "User ID");
      if (interaction.guildId) {
        InputValidator.validateDiscordId(interaction.guildId, "Guild ID");
      }

      InputValidator.validateNumber(daysAgo.value as number, "days-ago", {
        min: 1,
        max: 50,
        integer: true,
      });
    } catch (error) {
      await replyOrFollowUp(interaction, {
        content: "Days ago must be between 1 and 50.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (hours) {
      try {
        InputValidator.validateNumber(hours, "hours", {
          min: 1,
          max: 24,
          integer: true,
        });
      } catch (error) {
        await replyOrFollowUp(interaction, {
          content: "Hours must be between 1 and 24.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    const jiraConfig = await JiraConfig.findOne({
      where: {
        guildId: interaction.guildId!,
        userId: interaction.user.id,
      },
    });

    if (!jiraConfig) {
      await replyOrFollowUp(interaction, {
        content: "You need to setup your Jira configuration first.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const finalHours = hours ?? (jiraConfig.dailyHours || 8);
    const totalSeconds = finalHours * 3600;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (daysAgo.value as number));
    if (startDate.getDay() === 0 || startDate.getDay() === 6) {
      await replyOrFollowUp(interaction, {
        content: "You can't check your work on weekends.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await replyOrFollowUp(interaction, {
      content: `Checking your work for ${startDate.toDateString()}...`,
      flags: MessageFlags.Ephemeral,
    });

    const serviceContainer = ServiceContainer.getInstance();
    const jiraService = serviceContainer.get<IJiraService>("IJiraService");

    const host = jiraConfig.host;
    const username = jiraConfig.username;
    const token = jiraConfig.token;
    const jqlOverride = jiraConfig.timeJqlOverride;

    const response = await jiraService.getIssuesWorked(
      host,
      username,
      token,
      jqlOverride?.format(daysAgo.value as string) ??
        `assignee WAS currentUser() ON -${daysAgo.value}d AND status WAS "In Progress" ON -${daysAgo.value}d`
    );

    if (!response.ok) {
      await replyOrFollowUp(interaction, {
        content: `Failed to get your work: ${InputValidator.sanitizeInput(
          response.statusText
        )}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const data = (await response.json()) as SearchResults;

    if (data.total === 0) {
      await replyOrFollowUp(interaction, {
        content: `You didn't work on any issues for ${startDate.toDateString()}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const issues = await Promise.all(
      data.issues.map(async (issue) => {
        return {
          id: issue.id,
          key: InputValidator.sanitizeInput(issue.key),
          summary: InputValidator.sanitizeInput(issue.fields.summary),
          assignee: InputValidator.sanitizeInput(
            issue.fields.assignee.displayName
          ),
          worklogs: (await (
            await jiraService.getIssueWorklog(
              host,
              username,
              token,
              issue.key,
              startDate
            )
          ).json()) as PageOfWorklogs,
        };
      })
    );

    const worklogs = issues.flatMap((issue) =>
      issue.worklogs.worklogs.filter(
        (worklog) => worklog.author.emailAddress === jiraConfig.username
      )
    );

    const embed = new EmbedBuilder();
    embed.setTitle(
      `You worked on ${data.total} issues ${
        daysAgo.value
      } days ago (${startDate.toDateString()})`
    );
    embed.setColor(worklogs.length ? "#00ffff" : "#00ff00");
    let issuesWithTimes: {
      issue: {
        id: string;
        key: string;
        summary: string;
        assignee: string;
        worklogs: PageOfWorklogs;
      };
      times: string;
      timeInSeconds: number;
    }[] = [];

    if (worklogs.length) {
      embed.addFields(
        issues.map((issue) => ({
          name: `${issue.key} (${issue.assignee})`,
          value: `${issue.summary}\n${issue.worklogs.worklogs
            .filter(
              (worklog) => worklog.author.emailAddress === jiraConfig.username
            )
            .map((worklog) => `- ${worklog.timeSpent}`)
            .join("\n")}`,
          inline: false,
        }))
      );
      embed.setFooter({
        text: `You logged ${
          worklogs.length
        } worklogs for a total of ${TimeUtils.formatTimeString(
          worklogs.reduce((acc, worklog) => acc + worklog.timeSpentSeconds, 0)
        )}.`,
      });
    } else {
      const timeDistribution = TimeUtils.distributeTimeFairly(
        totalSeconds,
        issues.length
      );
      const times = timeDistribution.fairDistribution || [];
      issuesWithTimes = issues.map((issue, index) => ({
        issue,
        timeInSeconds: times[index],
        times: TimeUtils.formatTimeString(times[index]),
      }));

      embed.addFields(
        issuesWithTimes.map((issue) => ({
          name: `${issue.issue.key} (${issue.issue.assignee})`,
          value: `${issue.issue.summary}\n- ${issue.times}`,
          inline: false,
        }))
      );
      embed.setFooter({
        text: `You didn't log any worklogs for a total of ${hours} hours.`,
      });
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("submit")
        .setLabel("Submit")
        .setStyle(ButtonStyle.Success)
    );

    const message = await interaction.editReply({
      embeds: [embed],
      components: worklogs.length ? [] : [row],
    });

    const filter = (i: MessageComponentInteraction) =>
      i.user.id === interaction.user.id;
    const collector = message.createMessageComponentCollector({
      filter,
      time: 15000,
    });

    collector?.on("collect", async (i: MessageComponentInteraction) => {
      if (i.customId === "submit") {
        await Promise.all(
          issuesWithTimes.map(async (issue) => {
            return await jiraService.postWorklog(
              host,
              username,
              token,
              issue.issue.id,
              issue.timeInSeconds,
              startDate
            );
          })
        );

        await i.update({
          content: "Time logged successfully.",
          embeds: [embed],
          components: [],
        });
      }
    });

    collector?.on("end", async (collected) => {
      if (collected.size === 0) {
        await interaction.editReply({
          embeds: [embed],
          components: [],
        });
      }
    });
  } catch (error) {
    await ErrorHandler.handleCommandError(interaction, error as Error);
  }
}

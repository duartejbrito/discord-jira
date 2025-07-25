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
import { JiraConfig } from "../db/models";
import { getIssuesWorked, getIssueWorklog, postWorklog } from "../jira";
import { PageOfWorklogs, SearchResults } from "../jira/models";
import { convertSeconds, distributeSeconds } from "../utils";

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
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const daysAgo = interaction.options.get("days-ago", true);
  const hours = (interaction.options.get("hours", false)?.value as number) ?? 8;
  const totalSeconds = hours * 3600;

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

  const host = jiraConfig.host;
  const username = jiraConfig.username;
  const token = jiraConfig.token;
  const jqlOverride = jiraConfig.timeJqlOverride;

  const response = await getIssuesWorked(
    host,
    username,
    token,
    jqlOverride?.format(daysAgo.value as string) ??
      `assignee WAS currentUser() ON -${daysAgo.value}d AND status WAS "In Progress" ON -${daysAgo.value}d`
  );

  if (!response.ok) {
    await replyOrFollowUp(interaction, {
      content: `Failed to get your work: ${response.statusText}`,
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
        key: issue.key,
        summary: issue.fields.summary,
        assignee: issue.fields.assignee.displayName,
        worklogs: (await (
          await getIssueWorklog(host, username, token, issue.key, startDate)
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
      } worklogs for a total of ${convertSeconds(
        worklogs.reduce((acc, worklog) => acc + worklog.timeSpentSeconds, 0)
      )}.`,
    });
  } else {
    const times = distributeSeconds(totalSeconds, issues.length, "fairly");
    issuesWithTimes = issues.map((issue, index) => ({
      issue,
      timeInSeconds: times[index],
      times: convertSeconds(times[index]),
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
          return await postWorklog(
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
}

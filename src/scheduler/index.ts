import { EmbedBuilder } from "discord.js";
import * as schedule from "node-schedule";
import { client } from "..";
import { JiraConfig } from "../db/models";
import { getIssuesWorked, getIssueWorklog, postWorklog } from "../jira";
import { PageOfWorklogs, SearchResults } from "../jira/models";
import { convertSeconds, distributeSeconds } from "../utils";
import { logInfo } from "../utils/logger";

export const tz = "Etc/UTC";
export const dailyRule = "0 6 * * 2-6";
// export const dailyRule = "* * * * *"; // For testing every minute
export const daysAgo = "1";
export const hours = 8;
export const totalSeconds = hours * 3600;

export function initScheduledJobs() {
  schedule.scheduleJob("daily-job", { rule: dailyRule, tz }, async () => {
    logInfo("Running daily job...");
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (daysAgo as unknown as number));
    const configs = await JiraConfig.findAll();

    for (const config of configs) {
      const response = await getIssuesWorked(
        config.host,
        config.username,
        config.token,
        config.timeJqlOverride?.format(daysAgo) ??
          `assignee WAS currentUser() ON -${daysAgo}d AND status WAS "In Progress" ON -${daysAgo}d`
      );

      if (!response.ok) {
        console.error(
          `Failed to get work for ${config.userId}: ${response.statusText}`
        );
        continue;
      }

      const data = (await response.json()) as SearchResults;

      if (data.total === 0) {
        logInfo(`No work found for ${config.userId}`);
        continue;
      }

      const issues = await Promise.all(
        data.issues.map(async (issue) => {
          return {
            id: issue.id,
            key: issue.key,
            summary: issue.fields.summary,
            assignee: issue.fields.assignee.displayName,
            worklogs: (await (
              await getIssueWorklog(
                config.host,
                config.username,
                config.token,
                issue.key,
                startDate
              )
            ).json()) as PageOfWorklogs,
          };
        })
      );

      const worklogs = issues.flatMap((issue) =>
        issue.worklogs.worklogs.filter(
          (worklog) => worklog.author.emailAddress === config.username
        )
      );

      if (worklogs.length !== 0) {
        console.log(`Worklogs found for ${config.userId}`);
        continue;
      }

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

      const times = distributeSeconds(totalSeconds, issues.length, "fairly");
      issuesWithTimes = issues.map((issue, index) => ({
        issue,
        timeInSeconds: times[index],
        times: convertSeconds(times[index]),
      }));

      await Promise.all(
        issuesWithTimes.map(async (issue) => {
          return await postWorklog(
            config.host,
            config.username,
            config.token,
            issue.issue.id,
            issue.timeInSeconds,
            startDate
          );
        })
      );

      const user = await client.guilds.cache
        .get(config.guildId)
        ?.members.fetch(config.userId);

      const embed = new EmbedBuilder();
      embed.setTitle(`You worked on ${data.total} issues yesterday`);
      embed.setColor("#00ff00");

      embed.addFields(
        issuesWithTimes.map((issue) => ({
          name: `${issue.issue.key} (${issue.issue.assignee})`,
          value: `${issue.issue.summary}\n- ${issue.times}`,
          inline: false,
        }))
      );
      embed.setFooter({
        text: "Your time was submitted.",
      });

      await user?.send({
        embeds: [embed],
      });
    }
  });
}

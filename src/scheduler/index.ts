import { EmbedBuilder } from "discord.js";
import * as schedule from "node-schedule";
import { client } from "..";
import { JiraConfig } from "../db/models";
import { PageOfWorklogs, SearchResults } from "../jira/models";
import { ErrorHandler } from "../services/ErrorHandler";
import { InputValidator } from "../services/InputValidator";
import { IJiraService } from "../services/JiraService";
import { ILoggerService } from "../services/LoggerService";
import { ServiceContainer } from "../services/ServiceContainer";
import { convertSeconds, distributeTime } from "../services/utils";

export const tz = "Etc/UTC";
export const dailyRule = "0 6 * * 2-6";
// export const dailyRule = "* * * * *"; // For testing every minute
export const daysAgo = "1";

export function initScheduledJobs() {
  schedule.scheduleJob("daily-job", { rule: dailyRule, tz }, async () => {
    const container = ServiceContainer.getInstance();
    const loggerService = container.get<ILoggerService>("ILoggerService");
    const jiraService = container.get<IJiraService>("IJiraService");
    loggerService.logInfo("Running daily job...");
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (daysAgo as unknown as number));
    const configs = await JiraConfig.findAll({
      where: {
        schedulePaused: false,
      },
    });

    for (const config of configs) {
      try {
        // Validate configuration data before processing
        try {
          InputValidator.validateJiraHost(config.host);
          InputValidator.validateEmail(config.username);
          InputValidator.validateApiToken(config.token);
          InputValidator.validateDiscordId(config.userId, "User ID");
          InputValidator.validateDiscordId(config.guildId, "Guild ID");

          // Validate daily hours if set
          if (config.dailyHours) {
            InputValidator.validateDailyHours(config.dailyHours);
          }
        } catch (validationError) {
          loggerService.error("Scheduler: Invalid configuration data", {
            userId: config.userId,
            guildId: config.guildId,
            error:
              validationError instanceof Error
                ? validationError.message
                : String(validationError),
          });
          continue;
        }

        loggerService.logInfo(`Processing config for user ${config.userId}`, {
          GuildId: config.guildId,
        });

        const jqlQuery =
          config.timeJqlOverride?.format(daysAgo) ??
          `assignee WAS currentUser() ON -${daysAgo}d AND status WAS "In Progress" ON -${daysAgo}d`;

        // Validate JQL query
        const validatedJql = InputValidator.validateJQL(jqlQuery);
        if (!validatedJql) {
          loggerService.error("Scheduler: Invalid JQL query", {
            userId: config.userId,
            guildId: config.guildId,
            jql: jqlQuery,
          });
          continue;
        }

        const response = await jiraService.getIssuesWorked(
          config.host,
          config.username,
          config.token,
          validatedJql
        );

        if (!response.ok) {
          ErrorHandler.handleSchedulerError(
            ErrorHandler.wrapJiraError(
              response,
              `getting work for user ${config.userId}`
            ),
            loggerService,
            {
              userId: config.userId,
              guildId: config.guildId,
              operation: "getIssuesWorked",
            }
          );
          continue;
        }

        const data = (await response.json()) as SearchResults;

        if (data.total === 0) {
          loggerService.logInfo(`No work found for ${config.userId}`);
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
                await jiraService.getIssueWorklog(
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
          loggerService.logInfo(
            `Worklogs found for ${config.userId} with ${worklogs.length} entries`,
            {
              GuildId: config.guildId,
            }
          );
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

        // Validate daily hours and time distribution
        const validatedDailyHours = InputValidator.validateDailyHours(
          config.dailyHours
        );
        const validatedTotalSeconds = validatedDailyHours * 3600;

        const timeDistribution = distributeTime(
          validatedTotalSeconds,
          issues.length,
          "fairly"
        );

        issuesWithTimes = issues
          .map((issue, index) => {
            const timeInSeconds = timeDistribution[index];

            // Validate time values before posting worklog
            try {
              InputValidator.validateNumber(timeInSeconds, "Time in seconds", {
                required: true,
                min: 60, // Minimum 1 minute
                max: 86400, // Maximum 24 hours
                integer: true,
              });
            } catch (timeError) {
              loggerService.error("Scheduler: Invalid time value", {
                userId: config.userId,
                guildId: config.guildId,
                issueKey: issue.key,
                timeInSeconds,
                error:
                  timeError instanceof Error
                    ? timeError.message
                    : String(timeError),
              });
              return null;
            }

            return {
              issue,
              timeInSeconds,
              times: convertSeconds(timeInSeconds),
            };
          })
          .filter(Boolean) as {
          issue: {
            id: string;
            key: string;
            summary: string;
            assignee: string;
            worklogs: PageOfWorklogs;
          };
          times: string;
          timeInSeconds: number;
        }[];

        await Promise.all(
          issuesWithTimes.map(async (issue) => {
            return await jiraService.postWorklog(
              config.host,
              config.username,
              config.token,
              issue.issue.key,
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
      } catch (error) {
        ErrorHandler.handleSchedulerError(
          error instanceof Error ? error : new Error(String(error)),
          loggerService,
          {
            userId: config.userId,
            guildId: config.guildId,
            operation: "processConfig",
          }
        );
      }
    }
  });
}

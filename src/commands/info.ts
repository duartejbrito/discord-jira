import {
  CommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { JiraConfig } from "../db/models/JiraConfig";
import { logInfo } from "../utils/logger";

export const name = "info";

export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription("Show your Jira configuration information.")
  .setContexts([InteractionContextType.Guild]);

export async function execute(interaction: CommandInteraction) {
  logInfo("Info command executed", { GuildId: interaction.guildId! });

  const config = await JiraConfig.findOne({
    where: { guildId: interaction.guildId!, userId: interaction.user.id },
  });

  if (config) {
    return interaction.reply({
      content: `Here is your Jira configuration information:
- Host: ${config.host}
- Username: ${config.username}
- Jira API Token: ${config.token}
- Time JQL Override: ${config.timeJqlOverride}
- Schedule Paused: ${config.schedulePaused ? "Yes" : "No"}`,
      flags: MessageFlags.Ephemeral,
    });
  } else {
    return interaction.reply({
      content: "No Jira configuration found for this user.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

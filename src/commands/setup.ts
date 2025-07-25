import {
  CommandInteraction,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { JiraConfig } from "../db/models";
import { getServerInfo } from "../jira";

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
  );

export async function execute(interaction: CommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const host = interaction.options.get("host", true);
  const username = interaction.options.get("username", true);
  const token = interaction.options.get("token", true);
  const jql = interaction.options.get("jql", false);

  const response = await getServerInfo(
    host.value as string,
    username.value as string,
    token.value as string
  );

  if (!response.ok) {
    await interaction.followUp({
      content: `Failed to connect to Jira: ${response.statusText}`,
      ephemeral: true,
    });
    return;
  }

  await JiraConfig.findOrCreate({
    where: {
      guildId: interaction.guildId!,
      userId: interaction.user.id,
    },
    defaults: {
      guildId: interaction.guildId!,
      host: host.value as string,
      username: username.value as string,
      token: token.value as string,
      userId: interaction.user.id,
      timeJqlOverride: jql?.value as string | undefined,
      schedulePaused: false,
    },
  });

  await interaction.followUp({
    content: "Your Jira configuration has been saved.",
    ephemeral: true,
  });
}

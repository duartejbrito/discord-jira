import {
  CommandInteraction,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  MessageFlags,
  EmbedBuilder,
} from "discord.js";
import { deployCommands, deployGuildCommands } from "../deploy-commands";
import { IConfigService } from "../services/ConfigService";
import { ILoggerService } from "../services/LoggerService";
import { ServiceContainer } from "../services/ServiceContainer";
import { commandsData, ownerCommandsData } from ".";

export const name = "deploy";

export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription("Deploy commands")
  .setContexts([InteractionContextType.Guild])
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: CommandInteraction) {
  const container = ServiceContainer.getInstance();
  const configService = container.get<IConfigService>("IConfigService");

  if (interaction.user.id !== configService.getOwnerUserId()) {
    const unauthorizedEmbed = new EmbedBuilder()
      .setTitle("🚫 Access Denied")
      .setDescription("You do not have permission to use this command.")
      .setColor(0xff0000)
      .setTimestamp();

    return await interaction.reply({
      embeds: [unauthorizedEmbed],
      flags: MessageFlags.Ephemeral,
    });
  }

  await deployCommands();
  await deployGuildCommands();

  const globalCommands = commandsData
    .filter((d) => d && d.name)
    .map((d) => `\`/${d.name}\``)
    .join(", ");

  const guildCommands = ownerCommandsData
    .filter((d) => d && d.name)
    .map((d) => `\`/${d.name}\``)
    .join(", ");

  const deployEmbed = new EmbedBuilder()
    .setTitle("🚀 Commands Deployed Successfully")
    .setDescription("All commands have been deployed and are ready to use!")
    .addFields([
      {
        name: "🌐 Global Commands",
        value: globalCommands || "None",
        inline: false,
      },
      {
        name: `🏠 Guild Commands (${configService.getOwnerGuildId()})`,
        value: guildCommands || "None",
        inline: false,
      },
      {
        name: "⚠️ Auto-Delete",
        value: "This message will automatically delete in 60 seconds.",
        inline: false,
      },
    ])
    .setColor(0x00ff00)
    .setTimestamp()
    .setFooter({
      text: `Deployed by ${interaction.user.username}`,
      iconURL: interaction.user.displayAvatarURL(),
    });

  await interaction
    .reply({
      embeds: [deployEmbed],
      flags: MessageFlags.Ephemeral,
    })
    .then(() => setTimeout(() => interaction.deleteReply(), 60000));

  const loggerService = container.get<ILoggerService>("ILoggerService");
  loggerService.logInfo("Deploy command executed", {
    GuildId: interaction.guildId!,
  });
}

import {
  CommandInteraction,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { config } from "../config";
import { deployCommands, deployGuildCommands } from "../deploy-commands";
import { ILoggerService } from "../services/interfaces";
import { ServiceContainer } from "../services/ServiceContainer";
import { commandsData, ownerCommandsData } from ".";

export const name = "deploy";

export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription("Deploy commands")
  .setContexts([InteractionContextType.Guild])
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: CommandInteraction) {
  if (interaction.user.id !== config.OWNER_ID) {
    return await interaction.reply({
      content: "You do not have permission to use this command.",
      flags: MessageFlags.Ephemeral,
    });
  }

  await deployCommands();
  await deployGuildCommands();

  await interaction
    .reply({
      content: `Commands globally deployed:\n${commandsData
        .filter((d) => d && d.name)
        .map((d) => `/${d.name}`)
        .join("\n")}\nCommands deployed for guild ${
        config.OWNER_GUILD_ID
      }\n${ownerCommandsData
        .filter((d) => d && d.name)
        .map((d) => `/${d.name}`)
        .join("\n")}`,
      flags: MessageFlags.Ephemeral,
    })
    .then(() => setTimeout(() => interaction.deleteReply(), 60000));

  const container = ServiceContainer.getInstance();
  const loggerService = container.get<ILoggerService>("ILoggerService");
  loggerService.logInfo("Deploy command executed", {
    GuildId: interaction.guildId!,
  });
}

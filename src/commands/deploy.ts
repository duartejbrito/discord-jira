import {
  CommandInteraction,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { deployCommands, deployGuildCommands } from "../deploy-commands";
import { IConfigService, ILoggerService } from "../services/interfaces";
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
        .join(
          "\n"
        )}\nCommands deployed for guild ${configService.getOwnerGuildId()}\n${ownerCommandsData
        .filter((d) => d && d.name)
        .map((d) => `/${d.name}`)
        .join("\n")}`,
      flags: MessageFlags.Ephemeral,
    })
    .then(() => setTimeout(() => interaction.deleteReply(), 60000));

  const loggerService = container.get<ILoggerService>("ILoggerService");
  loggerService.logInfo("Deploy command executed", {
    GuildId: interaction.guildId!,
  });
}

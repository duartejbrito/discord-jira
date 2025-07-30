import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import { IRateLimitService } from "../services/RateLimitService";
import { ServiceContainer } from "../services/ServiceContainer";

export const name = "health";

export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription("Check the system health status")
  .addBooleanOption((option) =>
    option
      .setName("detailed")
      .setDescription("Show detailed health information")
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const serviceContainer = ServiceContainer.getInstance();
    const healthCheckService = ServiceContainer.getHealthCheckService();
    const rateLimitService =
      serviceContainer.get<IRateLimitService>("IRateLimitService");

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Check rate limiting
    try {
      rateLimitService.checkRateLimit(interaction.user.id, "health");
    } catch (error) {
      await interaction.editReply({
        content: `⏱️ **Rate Limited**: ${
          error instanceof Error ? error.message : "Please try again later."
        }`,
      });
      return;
    }

    const detailed = interaction.options.getBoolean("detailed") ?? false;

    // Run health checks
    const systemHealth = await healthCheckService.runAllChecks();

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle("🔍 System Health Status")
      .setTimestamp(new Date(systemHealth.timestamp))
      .setFooter({
        text: `Uptime: ${Math.round(systemHealth.uptime / 1000)}s`,
      });

    // Set color based on overall health
    switch (systemHealth.overall) {
      case "healthy":
        embed.setColor(0x00ff00); // Green
        break;
      case "degraded":
        embed.setColor(0xffaa00); // Orange
        break;
      case "unhealthy":
        embed.setColor(0xff0000); // Red
        break;
    }

    // Add overall status
    const statusEmoji = {
      healthy: "✅",
      degraded: "⚠️",
      unhealthy: "❌",
    };

    embed.addFields({
      name: "Overall Status",
      value: `${
        statusEmoji[systemHealth.overall]
      } ${systemHealth.overall.toUpperCase()}`,
      inline: true,
    });

    embed.addFields({
      name: "Checks Passed",
      value: `${
        systemHealth.checks.filter((c) => c.status === "healthy").length
      }/${systemHealth.checks.length}`,
      inline: true,
    });

    // Add individual check results
    if (detailed) {
      for (const check of systemHealth.checks) {
        const checkEmoji = statusEmoji[check.status];
        const duration = check.duration
          ? ` (${Math.round(check.duration)}ms)`
          : "";

        let value = `${checkEmoji} ${check.status.toUpperCase()}${duration}\n${
          check.message
        }`;

        if (check.details && Object.keys(check.details).length > 0) {
          const details = Object.entries(check.details)
            .map(([key, val]) => `${key}: ${val}`)
            .slice(0, 3) // Limit to 3 details to avoid embed limits
            .join(", ");
          value += `\n*${details}*`;
        }

        embed.addFields({
          name: `${
            check.name.charAt(0).toUpperCase() + check.name.slice(1)
          } Check`,
          value,
          inline: false,
        });
      }

      // Add system metrics
      const metrics = healthCheckService.getSystemMetrics();
      if (metrics.memory && typeof metrics.memory === "object") {
        const memory = metrics.memory as Record<string, number>;
        embed.addFields({
          name: "System Metrics",
          value: [
            `Memory: ${memory.heapUsed}MB / ${memory.heapTotal}MB`,
            `RSS: ${memory.rss}MB`,
            `Node.js: ${metrics.nodeVersion}`,
            `Platform: ${metrics.platform}`,
          ].join("\n"),
          inline: false,
        });
      }
    } else {
      // Summary view - just show failed checks
      const failedChecks = systemHealth.checks.filter(
        (c) => c.status !== "healthy"
      );

      if (failedChecks.length > 0) {
        const failedList = failedChecks
          .map(
            (check) =>
              `${statusEmoji[check.status]} ${check.name}: ${check.message}`
          )
          .join("\n");

        embed.addFields({
          name: "Issues Found",
          value: failedList,
          inline: false,
        });
      } else {
        embed.addFields({
          name: "Status",
          value: "✅ All systems operational",
          inline: false,
        });
      }

      embed.addFields({
        name: "Note",
        value: "Use `/health detailed:true` for more information",
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await interaction.editReply({
      content: `❌ Health check failed: ${errorMessage}`,
    });
  }
}

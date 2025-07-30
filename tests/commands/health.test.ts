/* eslint-disable @typescript-eslint/no-explicit-any */
import { MessageFlags } from "discord.js";
import { execute } from "../../src/commands/health";
import { HealthCheckService } from "../../src/services/HealthCheckService";
import { ServiceContainer } from "../../src/services/ServiceContainer";
import {
  createMockInteraction,
  createMockServiceContainer,
} from "../test-utils";

// Mock Discord.js components
jest.mock("discord.js", () => ({
  ...jest.requireActual("discord.js"),
  EmbedBuilder: jest.fn().mockImplementation(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
  })),
}));

// Mock dependencies
jest.mock("../../src/services/ServiceContainer");
jest.mock("../../src/services/HealthCheckService");

describe("Health Command", () => {
  let mockContainer: any;
  let mockServices: any;
  let mockInteraction: any;
  let mockHealthCheckService: jest.Mocked<HealthCheckService>;

  const mockSystemHealth = {
    overall: "healthy" as const,
    checks: [
      {
        name: "database",
        status: "healthy" as const,
        message: "Database connection healthy",
        duration: 50,
        timestamp: Date.now(),
        details: { responseTime: "50ms", dialect: "sqlite" },
      },
      {
        name: "discord",
        status: "healthy" as const,
        message: "Discord connection healthy",
        duration: 0,
        timestamp: Date.now(),
        details: { guilds: 1, uptime: 3600, ping: 25 },
      },
    ],
    uptime: 3600000,
    timestamp: Date.now(),
  };

  const mockSystemMetrics = {
    uptime: 3600,
    memory: {
      heapUsed: 50,
      heapTotal: 100,
      rss: 80,
      external: 10,
    },
    cpu: { user: 1000, system: 500 },
    nodeVersion: "v18.0.0",
    platform: "linux",
    arch: "x64",
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Use test utilities for consistent mock setup
    const containerSetup = createMockServiceContainer();
    mockContainer = containerSetup.mockContainer;
    mockServices = containerSetup.mockServices;

    // Mock the ServiceContainer.getInstance method
    (ServiceContainer.getInstance as jest.Mock).mockReturnValue(mockContainer);

    // Create mock interaction
    mockInteraction = createMockInteraction({
      guildId: "123456789012345678",
      user: { id: "testuser", username: "testuser" },
      options: {
        getBoolean: jest.fn().mockReturnValue(false),
      },
    });

    // Mock health check service
    mockHealthCheckService = {
      runAllChecks: jest.fn().mockResolvedValue(mockSystemHealth),
      getSystemMetrics: jest.fn().mockReturnValue(mockSystemMetrics),
    } as unknown as jest.Mocked<HealthCheckService>;

    // Mock ServiceContainer static methods
    (ServiceContainer.getHealthCheckService as jest.Mock).mockReturnValue(
      mockHealthCheckService
    );
  });

  describe("execute", () => {
    it("should display health status successfully", async () => {
      await execute(mockInteraction);

      expect(mockInteraction.deferReply).toHaveBeenCalledWith({
        flags: MessageFlags.Ephemeral,
      });
      expect(
        mockServices.IRateLimitService.checkRateLimit
      ).toHaveBeenCalledWith("testuser", "health");
      expect(mockHealthCheckService.runAllChecks).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should display detailed health status when detailed option is true", async () => {
      // Set up the detailed option to return true
      mockInteraction.options.getBoolean = jest.fn().mockReturnValue(true);

      await execute(mockInteraction);

      // Just verify that the command executed successfully with detailed option
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should handle rate limit errors", async () => {
      const rateLimitError = new Error("Rate limit exceeded");
      mockServices.IRateLimitService.checkRateLimit.mockImplementation(() => {
        throw rateLimitError;
      });

      await execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: "⏱️ **Rate Limited**: Rate limit exceeded",
      });
      expect(mockHealthCheckService.runAllChecks).not.toHaveBeenCalled();
    });

    it("should handle health check errors", async () => {
      const healthError = new Error("Health check failed");
      mockHealthCheckService.runAllChecks.mockRejectedValue(healthError);

      await execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: "❌ Health check failed: Health check failed",
      });
    });

    it("should handle unhealthy status", async () => {
      const unhealthySystemHealth = {
        ...mockSystemHealth,
        overall: "unhealthy" as const,
      };
      mockHealthCheckService.runAllChecks.mockResolvedValue(
        unhealthySystemHealth
      );

      await execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should handle degraded status with failed checks", async () => {
      const degradedSystemHealth = {
        ...mockSystemHealth,
        overall: "degraded" as const,
        checks: [
          ...mockSystemHealth.checks,
          {
            name: "services",
            status: "degraded" as const,
            message: "Some services are slow",
            duration: 2000,
            timestamp: Date.now(),
          },
        ],
      };
      mockHealthCheckService.runAllChecks.mockResolvedValue(
        degradedSystemHealth
      );

      await execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should display detailed view with system metrics", async () => {
      mockInteraction.options.getBoolean = jest.fn().mockReturnValue(true);

      await execute(mockInteraction);

      expect(mockHealthCheckService.getSystemMetrics).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalled();

      // Verify the call contains embed
      const editReplyCall = mockInteraction.editReply.mock.calls[0][0];
      expect(editReplyCall).toHaveProperty("embeds");
      expect(editReplyCall.embeds).toHaveLength(1);
    });

    it("should handle detailed view with checks that have no details", async () => {
      const healthWithoutDetails = {
        ...mockSystemHealth,
        checks: [
          {
            name: "simple",
            status: "healthy" as const,
            message: "Simple check",
            timestamp: Date.now(),
            duration: 0,
          },
        ],
      };
      mockInteraction.options.getBoolean = jest.fn().mockReturnValue(true);
      mockHealthCheckService.runAllChecks.mockResolvedValue(
        healthWithoutDetails
      );

      await execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should handle summary view with failed checks", async () => {
      const healthWithFailures = {
        ...mockSystemHealth,
        overall: "degraded" as const,
        checks: [
          {
            name: "database",
            status: "unhealthy" as const,
            message: "Database connection failed",
            timestamp: Date.now(),
            duration: 0,
          },
          {
            name: "discord",
            status: "degraded" as const,
            message: "Discord connection slow",
            timestamp: Date.now(),
            duration: 1500,
          },
        ],
      };
      mockHealthCheckService.runAllChecks.mockResolvedValue(healthWithFailures);

      await execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
      const editReplyCall = mockInteraction.editReply.mock.calls[0][0];
      expect(editReplyCall).toHaveProperty("embeds");
    });

    it("should handle summary view with all systems operational", async () => {
      await execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
      const editReplyCall = mockInteraction.editReply.mock.calls[0][0];
      expect(editReplyCall).toHaveProperty("embeds");
    });

    it("should handle non-Error exceptions", async () => {
      mockHealthCheckService.runAllChecks.mockRejectedValue("String error");

      await execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: "❌ Health check failed: String error",
      });
    });

    it("should handle rate limit non-Error exceptions", async () => {
      mockServices.IRateLimitService.checkRateLimit.mockImplementation(() => {
        throw "Non-error exception";
      });

      await execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: "⏱️ **Rate Limited**: Please try again later.",
      });
    });

    it("should handle metrics without memory object", async () => {
      mockInteraction.options.getBoolean = jest.fn().mockReturnValue(true);
      mockHealthCheckService.getSystemMetrics.mockReturnValue({
        ...mockSystemMetrics,
        memory: null,
      });

      await execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should handle checks with many details (over 3)", async () => {
      const healthWithManyDetails = {
        ...mockSystemHealth,
        checks: [
          {
            name: "complex",
            status: "healthy" as const,
            message: "Complex check",
            timestamp: Date.now(),
            duration: 100,
            details: {
              detail1: "value1",
              detail2: "value2",
              detail3: "value3",
              detail4: "value4",
              detail5: "value5",
            },
          },
        ],
      };
      mockInteraction.options.getBoolean = jest.fn().mockReturnValue(true);
      mockHealthCheckService.runAllChecks.mockResolvedValue(
        healthWithManyDetails
      );

      await execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */
import { MessageFlags } from "discord.js";
import { execute } from "../../src/commands/ping";
import { ServiceContainer } from "../../src/services/ServiceContainer";
import {
  createMockInteraction,
  createMockServiceContainer,
  testAssertions,
} from "../test-utils";

// Enable Discord.js mock
jest.mock("discord.js");

// Mock the ServiceContainer
jest.mock("../../src/services/ServiceContainer");

describe("ping command", () => {
  let mockContainer: any;
  let mockServices: any;
  let mockInteraction: any;

  beforeEach(() => {
    // Reset all mocks
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
      user: { id: "987654321098765432", username: "testuser" },
    });
  });

  describe("successful execution", () => {
    it("should reply with pong message", async () => {
      await execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: "Pong!",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should log the ping command execution", async () => {
      await execute(mockInteraction);

      testAssertions.expectServiceCall(
        mockServices.ILoggerService,
        "logInfo",
        "Executing ping command",
        {
          GuildId: "123456789012345678",
          UserId: "987654321098765432",
        }
      );
    });
  });

  describe("error handling", () => {
    it("should handle service container not initialized error", async () => {
      mockContainer.get.mockImplementation(() => {
        throw new Error("Service container not initialized");
      });

      await execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringMatching(
            /^❌ \*\*Unexpected Error\*\*.*Error ID:/s
          ),
          flags: MessageFlags.Ephemeral,
        })
      );
    });

    it("should handle unknown service error", async () => {
      mockContainer.get.mockImplementation((serviceName: string) => {
        throw new Error(`Unknown service: ${serviceName}`);
      });

      await execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringMatching(
            /^❌ \*\*Unexpected Error\*\*.*Error ID:/s
          ),
          flags: MessageFlags.Ephemeral,
        })
      );
    });

    it("should handle string error", async () => {
      mockContainer.get.mockImplementation(() => {
        throw "String error";
      });

      await execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringMatching(
            /^❌ \*\*Unexpected Error\*\*.*Error ID:/s
          ),
          flags: MessageFlags.Ephemeral,
        })
      );
    });
  });
});

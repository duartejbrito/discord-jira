/* eslint-disable @typescript-eslint/no-explicit-any */
import { MessageFlags } from "discord.js";
import { execute } from "../../src/commands/deploy";
import { deployCommands, deployGuildCommands } from "../../src/deploy-commands";
import { ServiceContainer } from "../../src/services/ServiceContainer";
import {
  createMockInteraction,
  createMockServiceContainer,
} from "../test-utils";

// Mock dependencies
jest.mock("../../src/deploy-commands");
jest.mock("../../src/services/ServiceContainer");

const mockDeployCommands = deployCommands as jest.MockedFunction<
  typeof deployCommands
>;
const mockDeployGuildCommands = deployGuildCommands as jest.MockedFunction<
  typeof deployGuildCommands
>;

describe("Deploy Command", () => {
  let mockInteraction: any;
  let mockContainer: any;
  let mockServices: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Use test utilities for consistent mock setup
    const containerSetup = createMockServiceContainer();
    mockContainer = containerSetup.mockContainer;
    mockServices = containerSetup.mockServices;

    // Mock the ServiceContainer.getInstance method
    (ServiceContainer.getInstance as jest.Mock).mockReturnValue(mockContainer);

    // Create mock interaction
    mockInteraction = createMockInteraction({
      guildId: "123456789",
      user: { id: "owner123" },
    });

    mockDeployCommands.mockResolvedValue(undefined);
    mockDeployGuildCommands.mockResolvedValue(undefined);
  });

  it("should deploy commands when user is owner", async () => {
    mockServices.IConfigService.getOwnerUserId.mockReturnValue("owner123");
    mockServices.IConfigService.getOwnerGuildId.mockReturnValue("guild123");

    await execute(mockInteraction);

    expect(mockDeployCommands).toHaveBeenCalled();
    expect(mockDeployGuildCommands).toHaveBeenCalled();
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining("Commands globally deployed"),
      flags: MessageFlags.Ephemeral,
    });
    expect(mockServices.ILoggerService.logInfo).toHaveBeenCalledWith(
      "Deploy command executed",
      {
        GuildId: "123456789",
      }
    );
  });

  it("should deny access when user is not owner", async () => {
    mockServices.IConfigService.getOwnerUserId.mockReturnValue(
      "differentowner"
    );

    await execute(mockInteraction);

    expect(mockDeployCommands).not.toHaveBeenCalled();
    expect(mockDeployGuildCommands).not.toHaveBeenCalled();
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: "You do not have permission to use this command.",
      flags: MessageFlags.Ephemeral,
    });
  });

  it("should handle deployment errors", async () => {
    mockServices.IConfigService.getOwnerUserId.mockReturnValue("owner123");
    mockDeployCommands.mockRejectedValue(new Error("Deployment failed"));

    await expect(execute(mockInteraction)).rejects.toThrow("Deployment failed");
  });

  it("should handle guild command deployment errors", async () => {
    mockServices.IConfigService.getOwnerUserId.mockReturnValue("owner123");
    mockDeployCommands.mockResolvedValue(undefined);
    mockDeployGuildCommands.mockRejectedValue(
      new Error("Guild deployment failed")
    );

    await expect(execute(mockInteraction)).rejects.toThrow(
      "Guild deployment failed"
    );
  });

  it("should handle service container errors", async () => {
    mockServices.IConfigService.getOwnerUserId.mockReturnValue("owner123");
    (ServiceContainer.getInstance as jest.Mock).mockImplementation(() => {
      throw new Error("Service container not initialized");
    });

    // The error should be thrown, not handled gracefully
    await expect(async () => {
      await execute(mockInteraction);
    }).rejects.toThrow("Service container not initialized");
  });
});

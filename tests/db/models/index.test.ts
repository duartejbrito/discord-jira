import { Sequelize } from "sequelize";
import { JiraConfig } from "../../../src/db/models/JiraConfig";

// Mock the database
const mockSync = jest.fn();
const mockDb = {
  sync: mockSync,
} as unknown as Sequelize;

jest.mock("../../../src/db", () => mockDb);

describe("DB Models Index", () => {
  beforeEach(() => {
    mockSync.mockReset();
    mockSync.mockResolvedValue(mockDb);
  });

  it("should export JiraConfig model", async () => {
    const { JiraConfig: ExportedJiraConfig } = await import(
      "../../../src/db/models"
    );

    expect(ExportedJiraConfig).toBeDefined();
    expect(typeof ExportedJiraConfig).toBe("function");
    expect(ExportedJiraConfig.name).toBe("JiraConfig");
    expect(ExportedJiraConfig).toBe(JiraConfig);
  });

  it("should initialize models and sync database", async () => {
    const { initModels } = await import("../../../src/db/models");

    // Spy on the initModel method
    const initModelSpy = jest
      .spyOn(JiraConfig, "initModel")
      .mockReturnValue(JiraConfig);

    const result = await initModels();

    // Verify initModel was called with the database instance
    expect(initModelSpy).toHaveBeenCalledWith(mockDb);

    // Verify database sync was called with alter: true
    expect(mockSync).toHaveBeenCalledWith({
      alter: true,
    });

    // Verify the return value contains JiraConfig
    expect(result).toEqual({ JiraConfig });

    // Clean up
    initModelSpy.mockRestore();
  });

  it("should handle database sync errors gracefully", async () => {
    const { initModels } = await import("../../../src/db/models");

    // Mock initModel to succeed
    const initModelSpy = jest
      .spyOn(JiraConfig, "initModel")
      .mockReturnValue(JiraConfig);

    // Mock sync to fail
    const syncError = new Error("Database sync failed");
    mockSync.mockRejectedValue(syncError);

    // Expect initModels to throw the sync error
    await expect(initModels()).rejects.toThrow("Database sync failed");

    // Clean up
    initModelSpy.mockRestore();
  });

  it("should handle model initialization errors", async () => {
    const { initModels } = await import("../../../src/db/models");

    // Mock initModel to fail
    const initError = new Error("Model initialization failed");
    const initModelSpy = jest
      .spyOn(JiraConfig, "initModel")
      .mockImplementation(() => {
        throw initError;
      });

    // Expect initModels to throw the init error
    await expect(initModels()).rejects.toThrow("Model initialization failed");

    // Clean up
    initModelSpy.mockRestore();
  });

  it("should return all initialized models", async () => {
    const { initModels } = await import("../../../src/db/models");

    const initModelSpy = jest
      .spyOn(JiraConfig, "initModel")
      .mockReturnValue(JiraConfig);

    const models = await initModels();

    // Verify the return object structure
    expect(models).toHaveProperty("JiraConfig");
    expect(models.JiraConfig).toBe(JiraConfig);
    expect(Object.keys(models)).toHaveLength(1);

    // Clean up
    initModelSpy.mockRestore();
  });
});

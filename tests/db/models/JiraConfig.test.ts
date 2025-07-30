import { Sequelize } from "sequelize";
import { JiraConfig } from "../../../src/db/models/JiraConfig";
import { EncryptionService } from "../../../src/services/EncryptionService";
import { ServiceContainer } from "../../../src/services/ServiceContainer";

describe("JiraConfig Model", () => {
  let sequelize: Sequelize;

  beforeAll(() => {
    // Create an in-memory SQLite database for testing
    sequelize = new Sequelize("sqlite::memory:", {
      logging: false, // Disable logging for tests
    });
  });

  beforeEach(async () => {
    // Initialize services
    const serviceContainer = ServiceContainer.getInstance();
    serviceContainer.register("IEncryptionService", new EncryptionService());

    // Initialize the model
    JiraConfig.initModel(sequelize);

    // Sync the database (create tables)
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("should create a JiraConfig instance with valid data", async () => {
    const configData = {
      guildId: "123456789012345678",
      host: "test.atlassian.net",
      username: "testuser@example.com",
      token: "validtesttoken123",
      userId: "987654321098765432",
      schedulePaused: false,
      dailyHours: 8,
    };

    const config = await JiraConfig.create(configData);

    expect(config.guildId).toBe(configData.guildId);
    expect(config.host).toBe(configData.host);
    expect(config.username).toBe(configData.username);
    // Since afterFind doesn't fire for create, let's find the record to decrypt it
    const foundConfig = await JiraConfig.findOne({
      where: { guildId: configData.guildId },
    });
    expect(foundConfig!.token).toBe(configData.token);
    expect(config.userId).toBe(configData.userId);
    expect(config.schedulePaused).toBe(configData.schedulePaused);
    expect(config.dailyHours).toBe(configData.dailyHours);
  });

  it("should allow optional timeJqlOverride", async () => {
    const configData = {
      guildId: "123456789012345678",
      host: "test.atlassian.net",
      username: "testuser@example.com",
      token: "validtesttoken123",
      userId: "987654321098765432",
      timeJqlOverride: "assignee = currentUser() AND updated >= -7d",
      schedulePaused: false,
      dailyHours: 8,
    };

    const config = await JiraConfig.create(configData);

    expect(config.timeJqlOverride).toBe(configData.timeJqlOverride);
  });

  it("should require guildId field", async () => {
    const configData = {
      host: "test.atlassian.net",
      username: "testuser@example.com",
      token: "validtesttoken123",
      userId: "987654321098765432",
      schedulePaused: false,
    };

    await expect(JiraConfig.create(configData as never)).rejects.toThrow();
  });

  it("should require host field", async () => {
    const configData = {
      guildId: "123456789012345678",
      username: "testuser@example.com",
      token: "validtesttoken123",
      userId: "987654321098765432",
      schedulePaused: false,
    };

    await expect(JiraConfig.create(configData as never)).rejects.toThrow();
  });

  it("should require username field", async () => {
    const configData = {
      guildId: "123456789012345678",
      host: "test.atlassian.net",
      token: "validtesttoken123",
      userId: "987654321098765432",
      schedulePaused: false,
    };

    await expect(JiraConfig.create(configData as never)).rejects.toThrow();
  });

  it("should require token field", async () => {
    const configData = {
      guildId: "123456789012345678",
      host: "test.atlassian.net",
      username: "testuser@example.com",
      userId: "987654321098765432",
      schedulePaused: false,
    };

    await expect(JiraConfig.create(configData as never)).rejects.toThrow();
  });

  it("should find config by guildId", async () => {
    const configData = {
      guildId: "123456789012345678",
      host: "test.atlassian.net",
      username: "testuser@example.com",
      token: "validtesttoken123",
      userId: "987654321098765432",
      schedulePaused: false,
      dailyHours: 8,
    };

    await JiraConfig.create(configData);

    const foundConfig = await JiraConfig.findOne({
      where: { guildId: "123456789012345678" },
    });

    expect(foundConfig).not.toBeNull();
    expect(foundConfig?.guildId).toBe(configData.guildId);
  });

  it("should update schedulePaused status", async () => {
    const configData = {
      guildId: "123456789012345678",
      host: "test.atlassian.net",
      username: "testuser@example.com",
      token: "validtesttoken123",
      userId: "987654321098765432",
      schedulePaused: false,
      dailyHours: 8,
    };

    const config = await JiraConfig.create(configData);

    config.schedulePaused = true;
    await config.save();

    const updatedConfig = await JiraConfig.findOne({
      where: { guildId: "123456789012345678" },
    });

    expect(updatedConfig?.schedulePaused).toBe(true);
  });

  it("should have default dailyHours of 8", async () => {
    const configData = {
      guildId: "123456789012345678",
      host: "test.atlassian.net",
      username: "testuser@example.com",
      token: "validtesttoken123",
      userId: "987654321098765432",
      schedulePaused: false,
    };

    const config = await JiraConfig.create(configData);

    expect(config.dailyHours).toBe(8);
  });

  it("should allow custom dailyHours", async () => {
    const configData = {
      guildId: "123456789012345678",
      host: "test.atlassian.net",
      username: "testuser@example.com",
      token: "validtesttoken123",
      userId: "987654321098765432",
      schedulePaused: false,
      dailyHours: 6,
    };

    const config = await JiraConfig.create(configData);

    expect(config.dailyHours).toBe(6);
  });
});

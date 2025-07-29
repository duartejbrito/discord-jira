import { Sequelize } from "sequelize";
import { JiraConfig } from "../../../src/db/models/JiraConfig";

describe("JiraConfig Model", () => {
  let sequelize: Sequelize;

  beforeAll(() => {
    // Create an in-memory SQLite database for testing
    sequelize = new Sequelize("sqlite::memory:", {
      logging: false, // Disable logging for tests
    });
  });

  beforeEach(async () => {
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
      guildId: "123456789",
      host: "test.atlassian.net",
      username: "testuser",
      token: "testtoken",
      userId: "user123",
      schedulePaused: false,
      dailyHours: 8,
    };

    const config = await JiraConfig.create(configData);

    expect(config.guildId).toBe(configData.guildId);
    expect(config.host).toBe(configData.host);
    expect(config.username).toBe(configData.username);
    expect(config.token).toBe(configData.token);
    expect(config.userId).toBe(configData.userId);
    expect(config.schedulePaused).toBe(configData.schedulePaused);
    expect(config.dailyHours).toBe(configData.dailyHours);
  });

  it("should allow optional timeJqlOverride", async () => {
    const configData = {
      guildId: "123456789",
      host: "test.atlassian.net",
      username: "testuser",
      token: "testtoken",
      userId: "user123",
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
      username: "testuser",
      token: "testtoken",
      userId: "user123",
      schedulePaused: false,
    };

    await expect(JiraConfig.create(configData as never)).rejects.toThrow();
  });

  it("should require host field", async () => {
    const configData = {
      guildId: "123456789",
      username: "testuser",
      token: "testtoken",
      userId: "user123",
      schedulePaused: false,
    };

    await expect(JiraConfig.create(configData as never)).rejects.toThrow();
  });

  it("should require username field", async () => {
    const configData = {
      guildId: "123456789",
      host: "test.atlassian.net",
      token: "testtoken",
      userId: "user123",
      schedulePaused: false,
    };

    await expect(JiraConfig.create(configData as never)).rejects.toThrow();
  });

  it("should require token field", async () => {
    const configData = {
      guildId: "123456789",
      host: "test.atlassian.net",
      username: "testuser",
      userId: "user123",
      schedulePaused: false,
    };

    await expect(JiraConfig.create(configData as never)).rejects.toThrow();
  });

  it("should find config by guildId", async () => {
    const configData = {
      guildId: "123456789",
      host: "test.atlassian.net",
      username: "testuser",
      token: "testtoken",
      userId: "user123",
      schedulePaused: false,
      dailyHours: 8,
    };

    await JiraConfig.create(configData);

    const foundConfig = await JiraConfig.findOne({
      where: { guildId: "123456789" },
    });

    expect(foundConfig).not.toBeNull();
    expect(foundConfig?.guildId).toBe(configData.guildId);
  });

  it("should update schedulePaused status", async () => {
    const configData = {
      guildId: "123456789",
      host: "test.atlassian.net",
      username: "testuser",
      token: "testtoken",
      userId: "user123",
      schedulePaused: false,
      dailyHours: 8,
    };

    const config = await JiraConfig.create(configData);

    config.schedulePaused = true;
    await config.save();

    const updatedConfig = await JiraConfig.findOne({
      where: { guildId: "123456789" },
    });

    expect(updatedConfig?.schedulePaused).toBe(true);
  });

  it("should have default dailyHours of 8", async () => {
    const configData = {
      guildId: "123456789",
      host: "test.atlassian.net",
      username: "testuser",
      token: "testtoken",
      userId: "user123",
      schedulePaused: false,
    };

    const config = await JiraConfig.create(configData);

    expect(config.dailyHours).toBe(8);
  });

  it("should allow custom dailyHours", async () => {
    const configData = {
      guildId: "123456789",
      host: "test.atlassian.net",
      username: "testuser",
      token: "testtoken",
      userId: "user123",
      schedulePaused: false,
      dailyHours: 6,
    };

    const config = await JiraConfig.create(configData);

    expect(config.dailyHours).toBe(6);
  });
});

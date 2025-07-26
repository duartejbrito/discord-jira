// Global test setup

// Mock environment variables
process.env.NODE_ENV = "test";
process.env.DISCORD_TOKEN = "mock-discord-token";
process.env.DISCORD_APP_ID = "mock-app-id";
process.env.OWNER_GUILD_ID = "mock-guild-id";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

// Global test setup

// Mock environment variables
process.env.NODE_ENV = "test";
process.env.DISCORD_TOKEN = "mock-discord-token";
process.env.DISCORD_CLIENT_ID = "mock-client-id"; // Fixed: was DISCORD_APP_ID
process.env.OWNER_GUILD_ID = "mock-guild-id";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.PG_CONNECTION_STRING = "postgresql://test:test@localhost:5432/test";

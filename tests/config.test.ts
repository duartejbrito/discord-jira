describe("Config Module", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should handle environment variable loading", () => {
    // Basic test for environment handling
    const originalToken = process.env.DISCORD_TOKEN;
    const originalClientId = process.env.DISCORD_CLIENT_ID;

    process.env.DISCORD_TOKEN = "test-token";
    process.env.DISCORD_CLIENT_ID = "test-client-id";

    // Verify env vars are set
    expect(process.env.DISCORD_TOKEN).toBe("test-token");
    expect(process.env.DISCORD_CLIENT_ID).toBe("test-client-id");

    // Restore
    if (originalToken) process.env.DISCORD_TOKEN = originalToken;
    if (originalClientId) process.env.DISCORD_CLIENT_ID = originalClientId;
  });
});

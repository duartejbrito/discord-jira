// Mock Discord.js client to prevent TokenInvalid errors during testing

const mockInteraction = {
  user: { id: "123456789" },
  guild: { id: "987654321" },
  channelId: "111222333",
  commandName: "test",
  options: {
    getString: jest.fn(),
    getInteger: jest.fn(),
    getUser: jest.fn(),
  },
  reply: jest.fn().mockResolvedValue({}),
  editReply: jest.fn().mockResolvedValue({}),
  deleteReply: jest.fn().mockResolvedValue({}),
  followUp: jest.fn().mockResolvedValue({}),
  deferReply: jest.fn().mockResolvedValue({}),
  isRepliable: jest.fn().mockReturnValue(true),
};

const mockChannel = {
  id: "111222333",
  name: "test-channel",
  send: jest.fn().mockResolvedValue({}),
  guild: { id: "987654321" },
};

const mockGuild = {
  id: "987654321",
  name: "Test Guild",
  channels: {
    cache: new Map([["111222333", mockChannel]]),
    fetch: jest.fn().mockResolvedValue(mockChannel),
  },
  members: {
    cache: new Map(),
    fetch: jest.fn(),
  },
};

const mockUser = {
  id: "123456789",
  username: "testuser",
  discriminator: "0001",
  tag: "testuser#0001",
  displayName: "Test User",
};

const mockClient = {
  login: jest.fn().mockResolvedValue("mock-token"),
  on: jest.fn(),
  once: jest.fn(),
  emit: jest.fn(),
  user: mockUser,
  users: {
    cache: new Map([["123456789", mockUser]]),
    fetch: jest.fn().mockResolvedValue(mockUser),
  },
  guilds: {
    cache: new Map([["987654321", mockGuild]]),
    fetch: jest.fn().mockResolvedValue(mockGuild),
  },
  channels: {
    cache: new Map([["111222333", mockChannel]]),
    fetch: jest.fn().mockResolvedValue(mockChannel),
  },
  application: {
    commands: {
      set: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      fetch: jest.fn().mockResolvedValue([]),
    },
  },
  destroy: jest.fn().mockResolvedValue(undefined),
  isReady: jest.fn().mockReturnValue(true),
  readyAt: new Date(),
};

const mockRest = {
  setToken: jest.fn(),
  put: jest.fn().mockResolvedValue([]),
  get: jest.fn().mockResolvedValue([]),
  post: jest.fn().mockResolvedValue({}),
  patch: jest.fn().mockResolvedValue({}),
  delete: jest.fn().mockResolvedValue({}),
};

const mockSlashCommandBuilder = {
  setName: jest.fn().mockReturnThis(),
  setDescription: jest.fn().mockReturnThis(),
  addStringOption: jest.fn().mockReturnThis(),
  addIntegerOption: jest.fn().mockReturnThis(),
  addUserOption: jest.fn().mockReturnThis(),
  addBooleanOption: jest.fn().mockReturnThis(),
  setRequired: jest.fn().mockReturnThis(),
  setChoices: jest.fn().mockReturnThis(),
  setContexts: jest.fn().mockReturnThis(),
  setDefaultMemberPermissions: jest.fn().mockReturnThis(),
  toJSON: jest.fn().mockReturnValue({
    name: "test-command",
    description: "Test command description",
    options: [],
  }),
};

// Mock the main Discord.js exports
module.exports = {
  Client: jest.fn().mockImplementation(() => mockClient),
  Events: {
    Ready: "ready",
    InteractionCreate: "interactionCreate",
    ClientReady: "ready",
  },
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 512,
    MessageContent: 32768,
  },
  REST: jest.fn().mockImplementation(() => mockRest),
  Routes: {
    applicationGuildCommands: jest
      .fn()
      .mockReturnValue("/applications/123/guilds/456/commands"),
    applicationCommands: jest
      .fn()
      .mockReturnValue("/applications/123/commands"),
  },
  SlashCommandBuilder: jest
    .fn()
    .mockImplementation(() => mockSlashCommandBuilder),
  MessageFlags: {
    Ephemeral: 64,
  },
  ActivityType: {
    Playing: 0,
    Streaming: 1,
    Listening: 2,
    Watching: 3,
    Custom: 4,
    Competing: 5,
  },
  InteractionContextType: {
    Guild: 0,
    BotDM: 1,
    PrivateChannel: 2,
  },
  PermissionFlagsBits: {
    Administrator: 8n,
    ManageChannels: 16n,
    ManageGuild: 32n,
    ViewChannel: 1024n,
    SendMessages: 2048n,
    ManageMessages: 8192n,
  },
  // Export mock instances for use in tests
  __mockClient: mockClient,
  __mockInteraction: mockInteraction,
  __mockChannel: mockChannel,
  __mockGuild: mockGuild,
  __mockUser: mockUser,
  __mockRest: mockRest,
  __mockSlashCommandBuilder: mockSlashCommandBuilder,
};

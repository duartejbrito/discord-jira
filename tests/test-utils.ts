/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Reusable test utilities to reduce code duplication across test files
 */

import { MessageFlags } from "discord.js";
import { IHttpService } from "../src/services/interfaces";

/**
 * Creates a mock ServiceContainer with common service mocks
 */
export function createMockServiceContainer() {
  const mockContainer = {
    get: jest.fn(),
    register: jest.fn(),
    clear: jest.fn(),
    getInstance: jest.fn(),
  };

  const mockServices = {
    ILoggerService: createMockILoggerService(),
    IJiraService: createMockIJiraService(),
    IHttpService: createMockIHttpService(),
    IConfigService: createMockIConfigService(),
    TimeUtils: createMockTimeUtils(),
  };

  mockContainer.get.mockImplementation((serviceName: string) => {
    if (serviceName in mockServices) {
      return mockServices[serviceName as keyof typeof mockServices];
    }
    throw new Error(`Unknown service: ${serviceName}`);
  });

  return { mockContainer, mockServices };
}

/**
 * Sets up ServiceContainer mock for testing
 */
export function setupServiceContainerMock() {
  const { mockContainer, mockServices } = createMockServiceContainer();

  // Mock the ServiceContainer module
  jest.doMock("../src/services/ServiceContainer", () => ({
    ServiceContainer: {
      getInstance: jest.fn().mockReturnValue(mockContainer),
      initializeServices: jest.fn().mockReturnValue(mockContainer),
    },
  }));

  return { mockContainer, mockServices };
}

/**
 * Creates a mock Discord ChatInputCommandInteraction
 */
export function createMockInteraction(overrides: Partial<any> = {}): any {
  const defaultInteraction = {
    guildId: "123456789",
    user: { id: "user123", username: "testuser" },
    guild: { id: "123456789" },
    channelId: "987654321",
    deferReply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    deleteReply: jest.fn().mockResolvedValue(undefined),
    options: {
      get: jest.fn(),
      getString: jest.fn(),
      getInteger: jest.fn(),
      getUser: jest.fn(),
    },
    isRepliable: jest.fn().mockReturnValue(true),
    replied: false,
    deferred: false,
  };

  return { ...defaultInteraction, ...overrides } as any;
}

/**
 * Creates a mock ILoggerService
 */
export function createMockILoggerService() {
  return {
    logInfo: jest.fn(),
    logWarn: jest.fn(),
    logError: jest.fn(),
    logDebug: jest.fn(),
    initialize: jest.fn(),
    getInstance: jest.fn(),
  };
}

/**
 * Creates a mock IJiraService
 */
export function createMockIJiraService() {
  return {
    getServerInfo: jest.fn().mockResolvedValue({ ok: true }),
    getIssuesWorked: jest.fn().mockResolvedValue({ ok: true, data: [] }),
    getIssueWorklog: jest
      .fn()
      .mockResolvedValue({ ok: true, data: { worklogs: [] } }),
    postWorklog: jest.fn().mockResolvedValue({ ok: true }),
  };
}

/**
 * Creates a mock IHttpService
 */
export function createMockIHttpService(): jest.Mocked<IHttpService> {
  return {
    fetch: jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: jest.fn().mockResolvedValue({}),
      text: jest.fn().mockResolvedValue(""),
    }),
  };
}

/**
 * Creates a mock IConfigService
 */
export function createMockIConfigService() {
  return {
    get: jest.fn(),
    getRequired: jest.fn(),
    getInstance: jest.fn(),
  };
}

/**
 * Creates a mock TimeUtils service
 */
export function createMockTimeUtils() {
  return {
    convertSeconds: jest.fn().mockReturnValue("1h 30m"),
    distributeTime: jest.fn().mockReturnValue([1800, 1800]),
  };
}

/**
 * Creates a mock database model
 */
export function createMockDatabaseModel<T = any>() {
  return {
    findOne: jest.fn(),
    findAll: jest.fn(),
    findOrCreate: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
    save: jest.fn(),
    // Add common Sequelize model properties
    ...({} as T),
  };
}

/**
 * Standard test setup for command tests
 */
export function setupCommandTest() {
  const { mockContainer, mockServices } = setupServiceContainerMock();
  const mockInteraction = createMockInteraction();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  return {
    mockContainer,
    mockServices,
    mockInteraction,
  };
}

/**
 * Creates mock response objects for HTTP calls
 */
export function createMockResponse(overrides: Partial<any> = {}) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: jest.fn().mockResolvedValue({}),
    text: jest.fn().mockResolvedValue(""),
    headers: new Map(),
    size: 0,
    buffer: jest.fn().mockResolvedValue(Buffer.from("")),
    ...overrides,
  } as any;
}

/**
 * Creates mock Discord client
 */
export function createMockClient() {
  return {
    user: {
      id: "bot123",
      username: "testbot",
      tag: "testbot#1234",
      displayName: "Test Bot",
    },
    guilds: {
      cache: new Map(),
      fetch: jest.fn(),
    },
    channels: {
      cache: new Map(),
      fetch: jest.fn(),
    },
    login: jest.fn().mockResolvedValue("mock-token"),
    on: jest.fn(),
    once: jest.fn(),
  };
}

/**
 * Mock environment variables for tests
 */
export function mockEnvironmentVariables(vars: Record<string, string>) {
  const originalEnv = process.env;

  beforeAll(() => {
    process.env = { ...originalEnv, ...vars };
  });

  afterAll(() => {
    process.env = originalEnv;
  });
}

/**
 * Common assertion helpers
 */
export const testAssertions = {
  /**
   * Assert that interaction was deferred with ephemeral flag
   */
  expectEphemeralDefer(mockInteraction: any) {
    expect(mockInteraction.deferReply).toHaveBeenCalledWith({
      flags: MessageFlags.Ephemeral,
    });
  },

  /**
   * Assert that service was called with specific parameters
   */
  expectServiceCall(mockService: any, method: string, ...expectedArgs: any[]) {
    expect(mockService[method]).toHaveBeenCalledWith(...expectedArgs);
  },

  /**
   * Assert that interaction replied with error message
   */
  expectErrorReply(mockInteraction: any, errorMessage?: string) {
    const lastCall =
      mockInteraction.followUp.mock.calls[
        mockInteraction.followUp.mock.calls.length - 1
      ];
    expect(lastCall[0]).toMatchObject({
      flags: MessageFlags.Ephemeral,
    });
    if (errorMessage) {
      expect(lastCall[0].content).toContain(errorMessage);
    }
  },

  /**
   * Assert that interaction replied with success message
   */
  expectSuccessReply(mockInteraction: any, successMessage?: string) {
    const lastCall =
      mockInteraction.followUp.mock.calls[
        mockInteraction.followUp.mock.calls.length - 1
      ];
    if (successMessage) {
      expect(lastCall[0].content).toContain(successMessage);
    }
  },
};

/**
 * Test data factories
 */
export const testDataFactory = {
  /**
   * Creates test Jira configuration
   */
  createJiraConfig(overrides: any = {}) {
    return {
      guildId: "123456789",
      host: "https://test.atlassian.net",
      username: "testuser@example.com",
      token: "test-token",
      userId: "user123",
      timeJqlOverride: null,
      schedulePaused: false,
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  },

  /**
   * Creates test issue data
   */
  createIssueData(overrides: any = {}) {
    return {
      id: "10001",
      key: "TEST-123",
      summary: "Test Issue",
      assignee: "testuser",
      worklogs: { worklogs: [] },
      ...overrides,
    };
  },

  /**
   * Creates test worklog data
   */
  createWorklogData(overrides: any = {}) {
    return {
      id: "10001",
      timeSpentSeconds: 3600,
      started: new Date().toISOString(),
      author: {
        displayName: "Test User",
        emailAddress: "test@example.com",
      },
      ...overrides,
    };
  },
};

/**
 * Time-related test utilities
 */
export const timeTestUtils = {
  /**
   * Creates a fixed date for consistent testing
   */
  mockDate(dateString = "2024-01-15T10:00:00.000Z") {
    const fixedDate = new Date(dateString);
    jest.spyOn(Date, "now").mockReturnValue(fixedDate.getTime());
    jest.spyOn(global, "Date").mockImplementation(() => fixedDate as any);
    return fixedDate;
  },

  /**
   * Restores original Date behavior
   */
  restoreDate() {
    jest.restoreAllMocks();
  },
};

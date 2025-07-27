import { ServiceContainer } from "../../src/services/ServiceContainer";
import { createMockServiceContainer } from "../test-utils";

// Mock the config
jest.mock("../../src/config", () => ({
  config: {
    PG_CONNECTION_STRING: "postgresql://test:test@localhost:5432/testdb",
    PG_LOGGING: true,
  },
}));

// Mock Sequelize constructor
let capturedLoggingFunction: ((...args: unknown[]) => void) | null = null;

const mockSequelizeInstance = {
  authenticate: jest.fn(),
  close: jest.fn(),
  sync: jest.fn(),
};

const MockedSequelize = jest.fn(
  (connectionString: string, options: { logging?: unknown }) => {
    // Capture the logging function when Sequelize is instantiated
    if (options.logging && typeof options.logging === "function") {
      capturedLoggingFunction = options.logging as (...args: unknown[]) => void;
    }
    return mockSequelizeInstance;
  }
);

jest.mock("sequelize", () => ({
  Sequelize: MockedSequelize,
  Options: {},
}));

// Mock ServiceContainer
jest.mock("../../src/services/ServiceContainer");

jest.mock("../../src/services/LoggerService", () => ({
  LoggerService: jest.fn(),
}));

describe("db/index", () => {
  let consoleDebugSpy: jest.SpyInstance;
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

    consoleDebugSpy = jest.spyOn(console, "debug").mockImplementation();
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
  });

  describe("Database Connection", () => {
    it("should create Sequelize instance with correct configuration", async () => {
      // Import after mocks are set up
      const { default: db } = await import("../../src/db/index");

      expect(MockedSequelize).toHaveBeenCalledWith(
        "postgresql://test:test@localhost:5432/testdb",
        {
          dialect: "postgres",
          benchmark: true,
          logging: expect.any(Function),
        }
      );
      expect(db).toBe(mockSequelizeInstance);
    });

    it("should export the database instance", async () => {
      const { default: db } = await import("../../src/db/index");
      expect(db).toBeDefined();
      expect(db).toBe(mockSequelizeInstance);
    });
  });

  describe("Logging Function", () => {
    beforeEach(async () => {
      // Ensure the module is imported and logging function is captured
      await import("../../src/db/index");
    });

    it("should use LoggerService when service container is available", () => {
      expect(capturedLoggingFunction).toBeDefined();

      const testSql = "SELECT * FROM test_table";
      const testTiming = 123;

      capturedLoggingFunction!(testSql, testTiming);

      expect(ServiceContainer.getInstance).toHaveBeenCalled();
      expect(mockContainer.get).toHaveBeenCalledWith("ILoggerService");
      expect(mockServices.ILoggerService.logDebug).toHaveBeenCalledWith(
        "[DB] Execution",
        {
          Timing: "123ms",
          Sql: testSql,
        }
      );
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it("should fallback to console.debug when service container throws error", () => {
      expect(capturedLoggingFunction).toBeDefined();

      // Make ServiceContainer.getInstance throw an error
      (ServiceContainer.getInstance as jest.Mock).mockImplementationOnce(() => {
        throw new Error("Service container not ready");
      });

      const testSql = "SELECT * FROM test_table";
      const testTiming = 456;

      capturedLoggingFunction!(testSql, testTiming);

      expect(ServiceContainer.getInstance).toHaveBeenCalled();
      expect(consoleDebugSpy).toHaveBeenCalledWith("[DB] Execution", {
        Timing: "456ms",
        Sql: testSql,
      });
    });

    it("should fallback to console.debug when service container get method throws error", () => {
      expect(capturedLoggingFunction).toBeDefined();

      // Make container.get throw an error
      mockContainer.get.mockImplementationOnce(() => {
        throw new Error("LoggerService not found");
      });

      const testSql = "INSERT INTO test_table VALUES (1)";
      const testTiming = 789;

      capturedLoggingFunction!(testSql, testTiming);

      expect(ServiceContainer.getInstance).toHaveBeenCalled();
      expect(mockContainer.get).toHaveBeenCalledWith("ILoggerService");
      expect(consoleDebugSpy).toHaveBeenCalledWith("[DB] Execution", {
        Timing: "789ms",
        Sql: testSql,
      });
    });

    it("should handle undefined timing parameter", () => {
      expect(capturedLoggingFunction).toBeDefined();

      const testSql = "UPDATE test_table SET value = 1";
      const testTiming = undefined;

      capturedLoggingFunction!(testSql, testTiming);

      expect(mockServices.ILoggerService.logDebug).toHaveBeenCalledWith(
        "[DB] Execution",
        {
          Timing: "undefinedms",
          Sql: testSql,
        }
      );
    });

    it("should handle null timing parameter", () => {
      expect(capturedLoggingFunction).toBeDefined();

      const testSql = "DELETE FROM test_table";
      const testTiming = null;

      capturedLoggingFunction!(testSql, testTiming);

      expect(mockServices.ILoggerService.logDebug).toHaveBeenCalledWith(
        "[DB] Execution",
        {
          Timing: "undefinedms",
          Sql: testSql,
        }
      );
    });
  });
});

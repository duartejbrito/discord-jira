import { HttpService } from "../../src/services/HttpService";
import { IHttpService } from "../../src/services/interfaces";
import { JiraService } from "../../src/services/JiraService";
import { ServiceContainer } from "../../src/services/ServiceContainer";

describe("ServiceContainer", () => {
  let container: ServiceContainer;

  beforeEach(() => {
    container = ServiceContainer.getInstance();
    container.clear(); // Clear any existing services
  });

  describe("basic container operations", () => {
    it("should register and retrieve services", () => {
      const mockService = { test: "value" };

      container.register("TestService", mockService);
      const retrieved = container.get<typeof mockService>("TestService");

      expect(retrieved).toBe(mockService);
    });

    it("should throw error for unregistered service", () => {
      expect(() => {
        container.get("NonexistentService");
      }).toThrow("Service NonexistentService not found in container");
    });

    it("should maintain singleton pattern", () => {
      const container1 = ServiceContainer.getInstance();
      const container2 = ServiceContainer.getInstance();

      expect(container1).toBe(container2);
    });
  });

  describe("service initialization", () => {
    it("should initialize services with proper dependencies", () => {
      const initializedContainer = ServiceContainer.initializeServices();

      // Should have registered HTTP service
      const httpService =
        initializedContainer.get<IHttpService>("IHttpService");
      expect(httpService).toBeInstanceOf(HttpService);

      // Should have registered Jira service with HTTP dependency
      const jiraService = initializedContainer.get<JiraService>("IJiraService");
      expect(jiraService).toBeInstanceOf(JiraService);
    });

    it("should provide same instances on subsequent gets", () => {
      const initializedContainer = ServiceContainer.initializeServices();

      const httpService1 =
        initializedContainer.get<IHttpService>("IHttpService");
      const httpService2 =
        initializedContainer.get<IHttpService>("IHttpService");

      expect(httpService1).toBe(httpService2);
    });
  });

  describe("dependency injection demonstration", () => {
    it("should allow services to use injected dependencies", async () => {
      // Create a mock HTTP service
      const mockHttpService: IHttpService = {
        fetch: jest.fn().mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({ version: "test" }),
        }),
      };

      // Register mock service
      container.register<IHttpService>("HttpService", mockHttpService);

      // Create and register Jira service with mock dependency
      const jiraService = new JiraService(mockHttpService);
      container.register<JiraService>("JiraService", jiraService);

      // Use the service - it should use the mocked HTTP service
      const retrievedJiraService = container.get<JiraService>("JiraService");
      await retrievedJiraService.getServerInfo("test.com", "user", "token");

      // Verify the mock was called
      expect(mockHttpService.fetch).toHaveBeenCalledWith(
        "https://test.com/rest/api/3/serverInfo",
        expect.any(Object)
      );
    });
  });

  describe("testing support", () => {
    it("should allow clearing services for test isolation", () => {
      container.register("TestService", { data: "test" });
      expect(() => container.get("TestService")).not.toThrow();

      container.clear();
      expect(() => container.get("TestService")).toThrow();
    });

    it("should allow overriding services for testing", () => {
      // Register production service
      const productionService = { type: "production" };
      container.register("Service", productionService);

      // Override with test service
      const testService = { type: "test" };
      container.register("Service", testService);

      // Should get the test version
      const retrieved = container.get<typeof testService>("Service");
      expect(retrieved.type).toBe("test");
    });
  });
});

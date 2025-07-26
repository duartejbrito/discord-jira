jest.mock("node-fetch");

import fetch from "node-fetch";
import { HttpService } from "../../src/services/HttpService";
import { createMockResponse } from "../test-utils";

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe("HttpService", () => {
  let httpService: HttpService;

  beforeEach(() => {
    jest.clearAllMocks();
    httpService = new HttpService();
  });

  it("should make HTTP requests", async () => {
    const mockResponse = createMockResponse({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ data: "test" }),
    });

    mockFetch.mockResolvedValue(mockResponse);

    const result = await httpService.fetch("https://api.example.com/test");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/test",
      undefined
    );
    expect(result).toBe(mockResponse);
  });

  it("should pass options to fetch", async () => {
    const mockResponse = createMockResponse({
      ok: true,
      status: 200,
    });
    const options = { method: "POST", body: "test data" };

    mockFetch.mockResolvedValue(mockResponse);

    await httpService.fetch("https://api.example.com/test", options);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/test",
      options
    );
  });

  it("should handle errors from fetch", async () => {
    const error = new Error("Network error");
    mockFetch.mockRejectedValue(error);

    await expect(
      httpService.fetch("https://api.example.com/test")
    ).rejects.toThrow("Network error");
  });
});

// Mock for node-fetch to resolve ES module import issues
const mockFetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(""),
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Map(),
  })
);

export default mockFetch;

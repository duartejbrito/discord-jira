import { IssueBean } from "../../../src/jira/models/IssueBean";
import { SearchResults } from "../../../src/jira/models/SearchResults";

describe("SearchResults Model", () => {
  it("should create a SearchResults instance", () => {
    const results = new SearchResults();

    results.total = 100;
    results.issues = [];

    expect(results.total).toBe(100);
    expect(results.issues).toEqual([]);
  });

  it("should allow setting properties after instantiation", () => {
    const results = new SearchResults();

    expect(results.total).toBeUndefined();
    expect(results.issues).toBeUndefined();

    results.total = 75;
    results.issues = [];

    expect(results.total).toBe(75);
    expect(results.issues).toEqual([]);
  });

  it("should handle issues array", () => {
    const results = new SearchResults();
    const issue1 = new IssueBean();
    const issue2 = new IssueBean();

    issue1.id = "1";
    issue1.key = "TEST-1";
    issue2.id = "2";
    issue2.key = "TEST-2";

    results.total = 2;
    results.issues = [issue1, issue2];

    expect(results.total).toBe(2);
    expect(results.issues).toHaveLength(2);
    expect(results.issues[0]).toBe(issue1);
    expect(results.issues[1]).toBe(issue2);
    expect(results.issues[0].key).toBe("TEST-1");
    expect(results.issues[1].key).toBe("TEST-2");
  });

  it("should handle different total values", () => {
    const results1 = new SearchResults();
    results1.total = 1000;

    const results2 = new SearchResults();
    results2.total = 0;

    expect(results1.total).toBe(1000);
    expect(results2.total).toBe(0);
  });

  it("should handle empty results", () => {
    const results = new SearchResults();
    results.total = 0;
    results.issues = [];

    expect(results.total).toBe(0);
    expect(results.issues).toEqual([]);
  });
});

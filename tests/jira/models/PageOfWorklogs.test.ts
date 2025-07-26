import { PageOfWorklogs } from "../../../src/jira/models/PageOfWorklogs";
import { Worklog } from "../../../src/jira/models/Worklog";

describe("PageOfWorklogs Model", () => {
  it("should create a PageOfWorklogs instance", () => {
    const page = new PageOfWorklogs();

    page.total = 100;
    page.worklogs = [];

    expect(page.total).toBe(100);
    expect(page.worklogs).toEqual([]);
  });

  it("should allow setting properties after instantiation", () => {
    const page = new PageOfWorklogs();

    expect(page.total).toBeUndefined();
    expect(page.worklogs).toBeUndefined();

    page.total = 75;
    page.worklogs = [];

    expect(page.total).toBe(75);
    expect(page.worklogs).toEqual([]);
  });

  it("should handle worklogs array", () => {
    const page = new PageOfWorklogs();
    const worklog1 = new Worklog();
    const worklog2 = new Worklog();

    page.total = 2;
    page.worklogs = [worklog1, worklog2];

    expect(page.total).toBe(2);
    expect(page.worklogs).toHaveLength(2);
    expect(page.worklogs[0]).toBe(worklog1);
    expect(page.worklogs[1]).toBe(worklog2);
  });

  it("should handle different total values", () => {
    const page1 = new PageOfWorklogs();
    page1.total = 1000;

    const page2 = new PageOfWorklogs();
    page2.total = 50;

    expect(page1.total).toBe(1000);
    expect(page2.total).toBe(50);
  });
});

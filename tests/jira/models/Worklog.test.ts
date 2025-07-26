import { User } from "../../../src/jira/models/User";
import { Worklog } from "../../../src/jira/models/Worklog";

describe("Worklog Model", () => {
  it("should create a Worklog instance", () => {
    const worklog = new Worklog();
    const user = new User();
    user.displayName = "John Doe";
    user.emailAddress = "john.doe@example.com";

    worklog.timeSpentSeconds = 3600;
    worklog.timeSpent = "1h";
    worklog.author = user;

    expect(worklog.timeSpentSeconds).toBe(3600);
    expect(worklog.timeSpent).toBe("1h");
    expect(worklog.author).toBe(user);
    expect(worklog.author.displayName).toBe("John Doe");
  });

  it("should allow setting properties after instantiation", () => {
    const worklog = new Worklog();

    expect(worklog.timeSpentSeconds).toBeUndefined();
    expect(worklog.timeSpent).toBeUndefined();
    expect(worklog.author).toBeUndefined();

    const user = new User();
    user.displayName = "Jane Smith";

    worklog.timeSpentSeconds = 7200;
    worklog.timeSpent = "2h";
    worklog.author = user;

    expect(worklog.timeSpentSeconds).toBe(7200);
    expect(worklog.timeSpent).toBe("2h");
    expect(worklog.author.displayName).toBe("Jane Smith");
  });

  it("should handle different time formats", () => {
    const worklog1 = new Worklog();
    worklog1.timeSpentSeconds = 1800;
    worklog1.timeSpent = "30m";

    const worklog2 = new Worklog();
    worklog2.timeSpentSeconds = 28800;
    worklog2.timeSpent = "8h";

    expect(worklog1.timeSpentSeconds).toBe(1800);
    expect(worklog1.timeSpent).toBe("30m");
    expect(worklog2.timeSpentSeconds).toBe(28800);
    expect(worklog2.timeSpent).toBe("8h");
  });
});

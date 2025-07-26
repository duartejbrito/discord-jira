import { IssueBean } from "../../../src/jira/models/IssueBean";
import { User } from "../../../src/jira/models/User";

describe("IssueBean Model", () => {
  it("should create an IssueBean instance", () => {
    const issue = new IssueBean();
    const user = new User();
    user.displayName = "John Doe";
    user.emailAddress = "john.doe@example.com";

    issue.id = "12345";
    issue.key = "TEST-123";
    issue.fields = {
      summary: "Test issue summary",
      assignee: user,
    };

    expect(issue.id).toBe("12345");
    expect(issue.key).toBe("TEST-123");
    expect(issue.fields.summary).toBe("Test issue summary");
    expect(issue.fields.assignee).toBe(user);
    expect(issue.fields.assignee.displayName).toBe("John Doe");
  });

  it("should allow setting properties after instantiation", () => {
    const issue = new IssueBean();

    expect(issue.id).toBeUndefined();
    expect(issue.key).toBeUndefined();
    expect(issue.fields).toBeUndefined();

    const user = new User();
    user.displayName = "Jane Smith";
    user.emailAddress = "jane.smith@example.com";

    issue.id = "67890";
    issue.key = "PROJ-456";
    issue.fields = {
      summary: "Another test issue",
      assignee: user,
    };

    expect(issue.id).toBe("67890");
    expect(issue.key).toBe("PROJ-456");
    expect(issue.fields.summary).toBe("Another test issue");
    expect(issue.fields.assignee.displayName).toBe("Jane Smith");
  });

  it("should handle different issue keys and IDs", () => {
    const issue1 = new IssueBean();
    issue1.id = "1";
    issue1.key = "ABC-1";

    const issue2 = new IssueBean();
    issue2.id = "999999";
    issue2.key = "XYZ-999";

    expect(issue1.id).toBe("1");
    expect(issue1.key).toBe("ABC-1");
    expect(issue2.id).toBe("999999");
    expect(issue2.key).toBe("XYZ-999");
  });

  it("should handle fields with different summaries", () => {
    const issue = new IssueBean();
    const user = new User();
    user.displayName = "Test User";

    issue.fields = {
      summary: "A very long issue summary that describes the problem in detail",
      assignee: user,
    };

    expect(issue.fields.summary).toBe(
      "A very long issue summary that describes the problem in detail"
    );
    expect(issue.fields.assignee.displayName).toBe("Test User");
  });
});

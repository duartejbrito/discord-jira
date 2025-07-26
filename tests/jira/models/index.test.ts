import {
  SearchResults,
  IssueBean,
  User,
  PageOfWorklogs,
  Worklog,
} from "../../../src/jira/models";

describe("JIRA Models Index", () => {
  it("should export SearchResults class", () => {
    expect(SearchResults).toBeDefined();
    expect(typeof SearchResults).toBe("function");

    const searchResults = new SearchResults();
    expect(searchResults).toBeInstanceOf(SearchResults);
  });

  it("should export IssueBean class", () => {
    expect(IssueBean).toBeDefined();
    expect(typeof IssueBean).toBe("function");

    const issueBean = new IssueBean();
    expect(issueBean).toBeInstanceOf(IssueBean);
  });

  it("should export User class", () => {
    expect(User).toBeDefined();
    expect(typeof User).toBe("function");

    const user = new User();
    expect(user).toBeInstanceOf(User);
  });

  it("should export PageOfWorklogs class", () => {
    expect(PageOfWorklogs).toBeDefined();
    expect(typeof PageOfWorklogs).toBe("function");

    const pageOfWorklogs = new PageOfWorklogs();
    expect(pageOfWorklogs).toBeInstanceOf(PageOfWorklogs);
  });

  it("should export Worklog class", () => {
    expect(Worklog).toBeDefined();
    expect(typeof Worklog).toBe("function");

    const worklog = new Worklog();
    expect(worklog).toBeInstanceOf(Worklog);
  });

  it("should export all models with correct names", () => {
    const exportedModels = {
      SearchResults,
      IssueBean,
      User,
      PageOfWorklogs,
      Worklog,
    };

    // Verify all expected exports are present
    expect(Object.keys(exportedModels)).toHaveLength(5);
    expect(exportedModels.SearchResults.name).toBe("SearchResults");
    expect(exportedModels.IssueBean.name).toBe("IssueBean");
    expect(exportedModels.User.name).toBe("User");
    expect(exportedModels.PageOfWorklogs.name).toBe("PageOfWorklogs");
    expect(exportedModels.Worklog.name).toBe("Worklog");
  });

  it("should allow creating instances with proper class hierarchy", () => {
    // Test User model functionality
    const user = new User();
    user.displayName = "Test User";
    user.emailAddress = "test@example.com";
    expect(user.displayName).toBe("Test User");
    expect(user.emailAddress).toBe("test@example.com");

    // Test Worklog model functionality
    const worklog = new Worklog();
    worklog.timeSpentSeconds = 3600;
    worklog.timeSpent = "1h";
    worklog.author = user;
    expect(worklog.timeSpentSeconds).toBe(3600);
    expect(worklog.timeSpent).toBe("1h");
    expect(worklog.author).toBe(user);
    expect(worklog.author.displayName).toBe("Test User");

    // Test IssueBean model functionality
    const issueBean = new IssueBean();
    issueBean.id = "12345";
    issueBean.key = "TEST-123";
    issueBean.fields = {
      summary: "Test issue",
      assignee: user,
    };
    expect(issueBean.id).toBe("12345");
    expect(issueBean.key).toBe("TEST-123");
    expect(issueBean.fields.summary).toBe("Test issue");
    expect(issueBean.fields.assignee).toBe(user);

    // Test SearchResults model functionality
    const searchResults = new SearchResults();
    searchResults.total = 2;
    searchResults.issues = [issueBean];
    expect(searchResults.total).toBe(2);
    expect(searchResults.issues).toHaveLength(1);
    expect(searchResults.issues[0]).toBe(issueBean);

    // Test PageOfWorklogs model functionality
    const pageOfWorklogs = new PageOfWorklogs();
    pageOfWorklogs.worklogs = [worklog];
    expect(pageOfWorklogs.worklogs).toHaveLength(1);
    expect(pageOfWorklogs.worklogs[0]).toBe(worklog);
  });

  it("should maintain proper relationships between models", () => {
    // Create interconnected model instances
    const author = new User();
    author.displayName = "John Developer";
    author.emailAddress = "john@company.com";

    const worklog1 = new Worklog();
    worklog1.timeSpentSeconds = 1800;
    worklog1.timeSpent = "30m";
    worklog1.author = author;

    const worklog2 = new Worklog();
    worklog2.timeSpentSeconds = 2700;
    worklog2.timeSpent = "45m";
    worklog2.author = author;

    const issue = new IssueBean();
    issue.id = "10001";
    issue.key = "PROJ-456";
    issue.fields = {
      summary: "Implement new feature",
      assignee: author,
    };

    const searchResults = new SearchResults();
    searchResults.total = 1;
    searchResults.issues = [issue];

    const pageOfWorklogs = new PageOfWorklogs();
    pageOfWorklogs.worklogs = [worklog1, worklog2];

    // Verify relationships
    expect(issue.fields.assignee).toBe(author);
    expect(worklog1.author).toBe(author);
    expect(worklog2.author).toBe(author);
    expect(searchResults.issues[0].fields.assignee.displayName).toBe(
      "John Developer"
    );
    expect(pageOfWorklogs.worklogs[0].author.emailAddress).toBe(
      "john@company.com"
    );
    expect(pageOfWorklogs.worklogs[1].author.emailAddress).toBe(
      "john@company.com"
    );
  });
});

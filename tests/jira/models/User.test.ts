import { User } from "../../../src/jira/models/User";

describe("User Model", () => {
  it("should create a User instance", () => {
    const user = new User();
    user.displayName = "John Doe";
    user.emailAddress = "john.doe@example.com";

    expect(user.displayName).toBe("John Doe");
    expect(user.emailAddress).toBe("john.doe@example.com");
  });

  it("should allow setting properties after instantiation", () => {
    const user = new User();

    expect(user.displayName).toBeUndefined();
    expect(user.emailAddress).toBeUndefined();

    user.displayName = "Jane Smith";
    user.emailAddress = "jane.smith@example.com";

    expect(user.displayName).toBe("Jane Smith");
    expect(user.emailAddress).toBe("jane.smith@example.com");
  });
});

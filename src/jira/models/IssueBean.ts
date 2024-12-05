import { User } from "./User";

export class IssueBean {
  declare id: string;
  declare key: string;
  declare fields: {
    summary: string;
    assignee: User;
  };
}

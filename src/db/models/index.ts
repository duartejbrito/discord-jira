import { JiraConfig } from "./JiraConfig";
import db from "..";

export { JiraConfig };

export async function initModels() {
  JiraConfig.initModel(db);

  await db.sync({
    alter: true,
  });

  return { JiraConfig };
}

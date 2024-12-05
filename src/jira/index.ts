import fetch from "node-fetch";

const version = "3";
const restUrl = `/rest/api/${version}`;

function getHeaders(username: string, token: string) {
  return {
    Authorization: `Basic ${Buffer.from(`${username}:${token}`).toString(
      "base64"
    )}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

export async function getServerInfo(
  url: string,
  username: string,
  token: string
) {
  return await fetch(`https://${url}${restUrl}/serverInfo`, {
    method: "GET",
    headers: getHeaders(username, token),
  });
}

export async function getIssuesWorked(
  url: string,
  username: string,
  token: string,
  // eslint-disable-next-line quotes
  jql = 'assignee WAS currentUser() ON -1d AND status WAS "In Progress" ON -1d'
) {
  const bodyData = {
    fields: ["key", "summary", "assignee"],
    fieldsByKeys: false,
    jql: jql,
    maxResults: 50,
    startAt: 0,
    validateQuery: "strict",
  };

  return await fetch(`https://${url}${restUrl}/search`, {
    method: "POST",
    headers: getHeaders(username, token),
    body: JSON.stringify(bodyData),
  });
}

export async function getIssueWorklog(
  url: string,
  username: string,
  token: string,
  issueKey: string,
  date: Date
) {
  const startedAfter = new Date(date);
  startedAfter.setHours(0, 0, 0, 0);

  const startedBefore = new Date(startedAfter);
  startedBefore.setDate(date.getDate() + 1);
  startedBefore.setHours(0, 0, 0, 0);

  const startedAfterTime = Date.UTC(
    startedAfter.getFullYear(),
    startedAfter.getMonth(),
    startedAfter.getDate()
  );
  const startedBeforeTime = Date.UTC(
    startedBefore.getFullYear(),
    startedBefore.getMonth(),
    startedBefore.getDate()
  );

  return await fetch(
    `https://${url}${restUrl}/issue/${issueKey}/worklog?startedAfter=${startedAfterTime}&startedBefore=${startedBeforeTime}`,
    {
      method: "GET",
      headers: getHeaders(username, token),
    }
  );
}

export async function postWorklog(
  url: string,
  username: string,
  token: string,
  issueKey: string,
  timeSpentSeconds: number,
  date: Date,
  notifyUsers = false
) {
  const started = new Date(date);
  started.setHours(9, 0, 0, 0);

  const bodyData = {
    started: started.toISOString().replace("Z", "+0000"),
    timeSpentSeconds: timeSpentSeconds,
  };

  return await fetch(
    `https://${url}${restUrl}/issue/${issueKey}/worklog?notifyUsers=${notifyUsers}`,
    {
      method: "POST",
      headers: getHeaders(username, token),
      body: JSON.stringify(bodyData),
    }
  );
}

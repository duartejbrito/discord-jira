import * as deploy from "./deploy";
import * as ping from "./ping";
import * as setup from "./setup";
import * as time from "./time";

export const allCommands = {
  ping,
  deploy,
  setup,
  time,
};

export const commands = {
  ping,
  setup,
  time,
};

export const ownerCommands = {
  deploy,
};

export const allCommandsData = Object.values(allCommands).map(
  (command) => command.data
);

export const commandsData = Object.values(commands).map(
  (command) => command.data
);

export const ownerCommandsData = Object.values(ownerCommands).map(
  (command) => command.data
);

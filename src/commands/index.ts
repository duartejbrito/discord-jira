import * as deploy from "./deploy";
import * as ping from "./ping";

export const allCommands = {
  ping,
  deploy,
};

export const commands = {
  ping,
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

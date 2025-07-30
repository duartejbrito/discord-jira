import * as deploy from "./deploy";
import * as health from "./health";
import * as hours from "./hours";
import * as info from "./info";
import * as pause from "./pause";
import * as ping from "./ping";
import * as setup from "./setup";
import * as time from "./time";

export const allCommands = {
  ping,
  deploy,
  setup,
  time,
  pause,
  info,
  hours,
  health,
};

export const commands = {
  ping,
  setup,
  time,
  pause,
  info,
  hours,
  health,
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

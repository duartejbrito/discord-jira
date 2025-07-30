import {
  allCommands,
  commands,
  ownerCommands,
  allCommandsData,
  commandsData,
  ownerCommandsData,
} from "../../src/commands/index";

describe("Commands Index", () => {
  describe("allCommands", () => {
    it("should export all command modules", () => {
      expect(allCommands).toBeDefined();
      expect(allCommands.ping).toBeDefined();
      expect(allCommands.deploy).toBeDefined();
      expect(allCommands.setup).toBeDefined();
      expect(allCommands.time).toBeDefined();
      expect(allCommands.pause).toBeDefined();
      expect(allCommands.hours).toBeDefined();
      expect(allCommands.health).toBeDefined();
      expect(Object.keys(allCommands)).toHaveLength(8);
    });

    it("should have execute functions for all commands", () => {
      expect(typeof allCommands.ping.execute).toBe("function");
      expect(typeof allCommands.deploy.execute).toBe("function");
      expect(typeof allCommands.setup.execute).toBe("function");
      expect(typeof allCommands.time.execute).toBe("function");
      expect(typeof allCommands.pause.execute).toBe("function");
      expect(typeof allCommands.info.execute).toBe("function");
    });

    it("should have data for all commands", () => {
      expect(allCommands.ping.data).toBeDefined();
      expect(allCommands.deploy.data).toBeDefined();
      expect(allCommands.setup.data).toBeDefined();
      expect(allCommands.time.data).toBeDefined();
      expect(allCommands.pause.data).toBeDefined();
      expect(allCommands.info.data).toBeDefined();
    });
  });

  describe("commands", () => {
    it("should export user commands (excluding deploy)", () => {
      expect(commands).toBeDefined();
      expect(commands.ping).toBeDefined();
      expect(commands.setup).toBeDefined();
      expect(commands.time).toBeDefined();
      expect(commands.pause).toBeDefined();
      expect(commands.hours).toBeDefined();
      expect(commands.health).toBeDefined();
      expect("deploy" in commands).toBe(false);
      expect(Object.keys(commands)).toHaveLength(7);
    });
  });

  describe("ownerCommands", () => {
    it("should export only owner-specific commands", () => {
      expect(ownerCommands).toBeDefined();
      expect(ownerCommands.deploy).toBeDefined();
      expect("ping" in ownerCommands).toBe(false);
      expect("setup" in ownerCommands).toBe(false);
      expect("time" in ownerCommands).toBe(false);
      expect("pause" in ownerCommands).toBe(false);
      expect("info" in ownerCommands).toBe(false);
      expect(Object.keys(ownerCommands)).toHaveLength(1);
    });
  });

  describe("allCommandsData", () => {
    it("should contain data for all commands", () => {
      expect(Array.isArray(allCommandsData)).toBe(true);
      expect(allCommandsData).toHaveLength(8);

      // Check that all data objects are SlashCommandBuilder instances
      allCommandsData.forEach((commandData) => {
        expect(commandData).toBeDefined();
        expect(commandData.toJSON).toBeDefined();
        expect(typeof commandData.toJSON).toBe("function");

        // Test that toJSON() returns valid command data structure
        const jsonData = commandData.toJSON();
        expect(jsonData).toBeDefined();
        expect(jsonData.name).toBeDefined();
        expect(typeof jsonData.name).toBe("string");
      });
    });

    it("should be created from Object.values mapping", () => {
      // Test that the data arrays are properly created from the command objects
      expect(allCommandsData.length).toBe(Object.keys(allCommands).length);
    });
  });

  describe("commandsData", () => {
    it("should contain data for user commands only", () => {
      expect(Array.isArray(commandsData)).toBe(true);
      expect(commandsData).toHaveLength(7);

      // Test that it has one less command than allCommands (missing deploy)
      expect(commandsData.length).toBe(allCommandsData.length - 1);

      // Test that each entry has valid structure
      commandsData.forEach((commandData) => {
        expect(commandData).toBeDefined();
        expect(commandData.toJSON).toBeDefined();
        expect(typeof commandData.toJSON).toBe("function");
      });
    });
  });

  describe("ownerCommandsData", () => {
    it("should contain data for owner commands only", () => {
      expect(Array.isArray(ownerCommandsData)).toBe(true);
      expect(ownerCommandsData).toHaveLength(1);

      // Test that it contains exactly one command (deploy)
      expect(ownerCommandsData.length).toBe(Object.keys(ownerCommands).length);

      // Test that the entry has valid structure
      ownerCommandsData.forEach((commandData) => {
        expect(commandData).toBeDefined();
        expect(commandData.toJSON).toBeDefined();
        expect(typeof commandData.toJSON).toBe("function");
      });
    });
  });
});

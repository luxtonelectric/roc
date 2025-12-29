// @ts-check
import fs from "fs";
import path from "path";
import CallGroup from "../model/CallGroup.js";

/**
 * CallGroupLoader - Service for loading and managing CallGroup configurations
 * Keeps CallGroup definitions separate from simulation configurations
 */
export default class CallGroupLoader {
  /** @type {string} */
  configPath;

  /** @type {Map<string, any>} */
  loadedConfigs = new Map();

  /**
   * @param {string} configPath - Path to CallGroup configuration directory
   */
  constructor(configPath = "./callgroups") {
    this.configPath = configPath;
  }

  /**
   * Load CallGroup configuration from file
   * @param {string} configName - Name of configuration file (without .json)
   * @returns {any|null} Configuration object or null if not found
   */
  loadConfig(configName) {
    const configFile = path.join(this.configPath, `${configName}.json`);
    
    try {
      if (!fs.existsSync(configFile)) {
        console.warn(`CallGroup config file not found: ${configFile}`);
        return null;
      }

      const configData = JSON.parse(fs.readFileSync(configFile, "utf8"));
      this.loadedConfigs.set(configName, configData);
      return configData;
    } catch (error) {
      console.error(`Error loading CallGroup config ${configName}:`, error);
      return null;
    }
  }

  /**
   * Get all available CallGroup configurations
   * @returns {string[]} Array of configuration names
   */
  getAvailableConfigs() {
    try {
      if (!fs.existsSync(this.configPath)) {
        return [];
      }

      return fs.readdirSync(this.configPath)
        .filter(file => file.endsWith(".json"))
        .map(file => file.replace(".json", ""));
    } catch (error) {
      console.error("Error listing CallGroup configs:", error);
      return [];
    }
  }

  /**
   * Load default CallGroup configuration
   * @returns {any|null}
   */
  loadDefaultConfig() {
    return this.loadConfig("default");
  }

  /**
   * Create CallGroups from configuration for a specific simulation
   * @param {string} configName - Configuration to use
   * @param {string} simId - Simulation ID
   * @param {Array} availablePhones - Array of Phone objects to populate groups
   * @returns {CallGroup[]} Array of created CallGroups
   */
  createCallGroupsForSim(configName, simId, availablePhones) {
    const config = this.loadedConfigs.get(configName) || this.loadConfig(configName);
    if (!config || !config.groups) {
      return [];
    }

    const callGroups = [];

    config.groups.forEach(groupConfig => {
      // Check if group applies to this simulation
      if (groupConfig.simId !== "*" && groupConfig.simId !== simId) {
        return; // Skip groups not for this sim
      }

      const members = [];

      // Handle auto-member population
      if (groupConfig.autoMembers) {
        const { pattern, includeAllPanels, maxMembers } = groupConfig.autoMembers;
        
        let matchingPhones = availablePhones;
        
        // Filter by pattern if specified
        if (pattern && pattern !== "*") {
          const regex = new RegExp(pattern.replace("*", ".*"));
          matchingPhones = availablePhones.filter(phone => 
            regex.test(phone.getId())
          );
        }

        // Limit number of members if specified
        if (maxMembers && matchingPhones.length > maxMembers) {
          matchingPhones = matchingPhones.slice(0, maxMembers);
        }

        // Convert Phone objects to member format
        matchingPhones.forEach(phone => {
          members.push({
            id: phone.getId(),
            name: phone.getName(),
            type: phone.toSimple().type,
            status: "available"
          });
        });
      }

      // Handle explicit member list
      if (groupConfig.members) {
        groupConfig.members.forEach(memberRef => {
          if (typeof memberRef === "string") {
            // Phone ID reference
            const phone = availablePhones.find(p => p.getId() === memberRef);
            if (phone) {
              members.push({
                id: phone.getId(),
                name: phone.getName(),
                type: phone.toSimple().type,
                status: "available"
              });
            }
          } else if (typeof memberRef === "object") {
            // Inline member definition
            members.push({
              id: memberRef.id,
              name: memberRef.name || "Unknown",
              type: memberRef.type || "unknown",
              status: memberRef.status || "available"
            });
          }
        });
      }

      // Create CallGroup with actual simId (not wildcard)
      const callGroup = new CallGroup(
        `${simId}_${groupConfig.id}`, // Prefix with simId to ensure uniqueness
        groupConfig.name,
        groupConfig.description || "",
        groupConfig.type,
        simId,
        members
      );

      callGroups.push(callGroup);
    });

    return callGroups;
  }

  /**
   * Save CallGroup configuration to file
   * @param {string} configName - Configuration name
   * @param {any} configData - Configuration data to save
   * @returns {boolean} Success status
   */
  saveConfig(configName, configData) {
    const configFile = path.join(this.configPath, `${configName}.json`);
    
    try {
      // Ensure directory exists
      if (!fs.existsSync(this.configPath)) {
        fs.mkdirSync(this.configPath, { recursive: true });
      }

      fs.writeFileSync(configFile, JSON.stringify(configData, null, 2));
      this.loadedConfigs.set(configName, configData);
      return true;
    } catch (error) {
      console.error(`Error saving CallGroup config ${configName}:`, error);
      return false;
    }
  }
}

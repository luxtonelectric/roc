// @ts-check
import chalk from 'chalk';
import fs from 'fs';
import Simulation from '../model/simulation.js';

/**
 * Service responsible for loading simulation files from disk
 * Provides caching and error handling for simulation data
 */
export default class SimulationLoader {
  /** @type {Map<string, Simulation>} */
  #cache = new Map();
  
  /** @type {string} */
  #simulationsPath;

  /**
   * @param {string} simulationsPath Path to simulations directory relative to import.meta.url
   */
  constructor(simulationsPath = '../../simulations') {
    this.#simulationsPath = simulationsPath;
  }

  /**
   * Read simulation file from disk
   * @param {string} simId 
   * @returns {object|null} Raw simulation config or null if file doesn't exist
   */
  #readSimFile(simId) {
    const filePath = new URL(`${this.#simulationsPath}/${simId}.json`, import.meta.url);
    try {
      const simConfig = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return simConfig;
    } catch (e) {
      console.error(chalk.red(`SimulationLoader: Couldn't read simulation file for ${simId}:`), e);
      return null;
    }
  }

  /**
   * Load simulation data, with caching
   * @param {string} simId The simulation ID to load
   * @param {boolean} forceReload Whether to bypass cache and reload from disk
   * @returns {Simulation|null} Simulation instance or null if not found/invalid
   */
  loadSimulation(simId, forceReload = false) {
    // Check cache first unless force reload is requested
    if (!forceReload && this.#cache.has(simId)) {
      return this.#cache.get(simId);
    }

    // Load from disk
    const simConfig = this.#readSimFile(simId);
    if (!simConfig) {
      return null;
    }

    try {
      //console.log(chalk.yellow('SimulationLoader'), chalk.green('Loading simulation from disk:'), chalk.white(simId));
      const simulation = Simulation.fromSimData(simId, simConfig);
      
      // Cache the loaded simulation
      this.#cache.set(simId, simulation);
      
      return simulation;
    } catch (error) {
      console.error(chalk.red(`SimulationLoader: Error creating simulation object for ${simId}:`), error);
      return null;
    }
  }

  /**
   * Gets basic simulation metadata without loading the full simulation
   * @param {string} simId 
   * @returns {{id: string, name: string}|null}
   */
  getSimulationMetadata(simId) {
    const simConfig = this.#readSimFile(simId);
    if (!simConfig) {
      return null;
    }
    
    return {
      id: simId,
      name: simConfig.name || simId
    };
  }

  /**
   * Get list of available simulations and their metadata
   * @returns {Promise<{id: string, name: string}[]>}
   */
  async getAvailableSimulations() {
    const simPath = new URL(this.#simulationsPath, import.meta.url);
    try {
      const files = await fs.promises.readdir(simPath);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => {
          const simId = file.replace('.json', '');
          return this.getSimulationMetadata(simId);
        })
        .filter(metadata => metadata !== null); // Filter out any that failed to load metadata
    } catch (e) {
      console.error(chalk.red('SimulationLoader: Error reading simulations directory:'), e);
      return [];
    }
  }

  /**
   * Clear the simulation cache
   * @param {string} [simId] Optional specific simulation to remove from cache. If not provided, clears all.
   */
  clearCache(simId) {
    if (simId) {
      this.#cache.delete(simId);
      console.log(chalk.yellow('SimulationLoader'), chalk.blue('Cleared cache for:'), chalk.white(simId));
    } else {
      this.#cache.clear();
      console.log(chalk.yellow('SimulationLoader'), chalk.blue('Cleared all simulation cache'));
    }
  }

  /**
   * Check if a simulation is cached
   * @param {string} simId 
   * @returns {boolean}
   */
  isCached(simId) {
    return this.#cache.has(simId);
  }

  /**
   * Get cache statistics
   * @returns {{size: number, simIds: string[]}}
   */
  getCacheStats() {
    return {
      size: this.#cache.size,
      simIds: Array.from(this.#cache.keys())
    };
  }
}

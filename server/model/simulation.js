// @ts-check
import Panel from "./panel.js";


export default class Simulation {
    id;
    /** @type {Panel[]} */
    panels;
    /** @type {boolean} */
    enabled;
    clock;
    /** @type {string} */
    name;
}
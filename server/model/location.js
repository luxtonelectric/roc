// @ts-check

export default class Location {
    /** @type {string} */
    simId;

    /** @type {string} */
    panelId;

    /**
     * 
     * @param {string} simId 
     * @param {string|null} panelId 
     */
    constructor(simId,panelId = null) {
        this.simId = simId;
        this.panelId = panelId;
    }
}
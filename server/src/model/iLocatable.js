/** @typedef {import("./location.js").default} Location */

export default class iLocatable {
  
  /** @type {iLocatable} */
  #carrier = null;

  /** @type {Location | null} */
  #location;

  constructor(location = null) {
    this.#location = location;
  }

  /**
   * 
   * @returns {Location | null}
   */
  getLocation() {
    if(this.#carrier) {
      return this.#carrier.getLocation();
    } else {
      return this.#location;
    }
  }

  /**
   * 
   * @param {Location | null} location 
   */ 
  setLocation(location) {
    if(this.#carrier) {
      throw new Error('Attempting to set location of phone that has a carrier')
    } else {
      this.#location = location;
    }
  }

  /**
   * 
   * @param {iLocatable} loc 
   * @returns 
   */
  isInSameSim(loc) {
    const myLoc = this.getLocation();
    if (!loc  || !loc.getLocation() || !myLoc)  {
      return false;
    }
    return myLoc.simId === loc.getLocation().simId;
  }

  /**
   * 
   * @param {iLocatable} loc 
   * @returns 
   */
  isInSamePanel(loc) {
    const myLoc = this.getLocation();
    if (!loc || !loc.getLocation() || !myLoc)  {
      return false;
    }
    return myLoc.simId === loc.getLocation().simId && myLoc.panelId === loc.getLocation().panelId;
  }

  /**
 * 
 * @param {iLocatable} carrier 
 */
  setCarrier(carrier) {
    this.#carrier = carrier
  }
}
import Location from "./location.js";

// @ts-check
export default class Panel {
    id;
    name;
    player;
    /** @type {Location[]} */
    neighbours;
    phone;
}
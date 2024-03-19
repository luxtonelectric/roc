import Location from "./location.js";
import PhonebookEntry from "./phonebookentry.js";

export default class Phone {
    static TYPES = {"FIXED": "fixed", "TRAIN":"train", "MOBILE":"Mobile"}
    id;
    /** @type {string} */
    name;
    type;
    /** @type {Location|null} */
    location;
    /** @type {string|null} */
    discordId;

    speedDial;
    trainsAndMobiles;

    constructor(id,name,type,location = null) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.location = location;
        this.discordId = null;
    }

    toSimple() {
        return new PhonebookEntry(this.id,this.name);
    }
}
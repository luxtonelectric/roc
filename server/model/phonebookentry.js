// @ts-check
export default class PhonebookEntry {
    id;
    /** @type {string} */
    name;
    type;

    constructor(id,name,type) {
        this.id = id;
        this.name = name;
        this.type = type;
    }
}
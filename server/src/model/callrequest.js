// @ts-check

import Phone from "./phone.js";

export default class CallRequest {
    static TYPES = {"P2P":"p2p","GROUP":"group","REC":"REC"};
    static LEVELS = {"NORMAL":"normal", "URGENT":"urgent","EMERGENCY":"emergency"};
    static STATUS = {"OFFERED": "offered", "ACCEPTED": "accepted", "REJECTED": "rejected", "ENDED": "ended"};
    id;
    /** @type {Phone} */
    sender;
    /** @type {Phone[]} */
    receivers = [];
    timePlaced;
    level;
    status;
    channel;
    type;

    /**
     * 
     * @param {Phone} sender 
     * @param {Phone | Phone[]} receiver
     * @param {string} [level=CallRequest.LEVELS.NORMAL] 
     */
    constructor(sender, receiver, type=CallRequest.TYPES.P2P,level = CallRequest.LEVELS.NORMAL) {
        this.sender = sender;
        this.receivers = Array.isArray(receiver)? receiver : new Array(receiver);
        this.type = type;
        this.level = level;
        this.id = crypto.randomUUID();
        this.timePlaced = Date.now();
        this.status = CallRequest.STATUS.OFFERED;
    }

    getReceiver() {
        if(this.type === CallRequest.TYPES.P2P) {
            return this.receivers[0];
        } else {
            throw new Error()
        }
    }

    getReceivers() {
        console.log('getReceivers length', this.receivers.length);
        return this.receivers;
    }

    /**
     * 
     * @param {Phone} receiver 
     */
    setReceiver(receiver) {
        this.receivers = new Array(receiver);
    }
}
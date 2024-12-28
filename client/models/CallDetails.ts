import type Phone from "./Phone";

export class CallDetails {
    static TYPES = { "P2P": "p2p", "GROUP": "group", "REC": "REC" };
    static LEVELS = { "NORMAL": "normal", "URGENT": "urgent", "EMERGENCY": "emergency" };
    static STATUS = { "OFFERED": "offered", "ACCEPTED": "accepted", "REJECTED": "rejected", "ENDED": "ended" };

    id: string;
    timePlaced: number;
    level: string;
    status: string;
    sender: Phone;
    receivers: Phone[];
    type: string;
    
    constructor(id: string, timePlaced: number, level: string, status: string, sender: Phone, receivers: Phone[], type: string) {
        this.id = id;
        this.timePlaced = timePlaced;
        this.level = level;
        this.status = status;
        this.sender = sender;
        this.receivers = receivers;
        this.type = type;
    }
}
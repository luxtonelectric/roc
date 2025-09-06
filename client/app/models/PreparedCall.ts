import type Phone from "./Phone";

export class PreparedCall {
    static TYPES = { "P2P": "p2p", "GROUP": "group", "REC": "REC" };
    static LEVELS = { "NORMAL": "normal", "URGENT": "urgent", "EMERGENCY": "emergency" };
    static STATUS = { "OFFERED": "offered", "ACCEPTED": "accepted", "REJECTED": "rejected", "ENDED": "ended" };

    level: string;
    sender: Phone;
    receivers: Phone[];
    type: string;
    
    constructor(sender: Phone, receivers: Phone[], type: string = PreparedCall.TYPES.P2P, level: string = PreparedCall.LEVELS.NORMAL) {
      this.sender = sender;
      this.receivers = receivers;
      this.type = type;
      this.level = level;
    }
}
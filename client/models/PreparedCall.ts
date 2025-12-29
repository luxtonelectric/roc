import Phone from "./Phone";
import type CallGroup from "./CallGroup";
import CallGroupClass from "./CallGroup";

// Union type for receivers - clean and type-safe
export type CallReceiver = Phone | CallGroup;

// ICall interface definition for TypeScript client-side type safety
export interface ICall {
  /** Unique call identifier (UUID) */
  id: string;
  /** Timestamp when call was created */
  timePlaced: number;
  /** Call priority level (NORMAL, URGENT, EMERGENCY) */
  level: string;
  /** Current call status (varies by call type) */
  status: string;
  /** Call type (P2P, GROUP, REC) */
  type: string;
  /** Discord voice channel ID (optional) */
  channel?: string | null;
  
  // Unified receiver architecture properties
  /** The phone/user initiating the call */
  sender: Phone;
  /** The receiver (Phone for P2P, CallGroup for GROUP/REC) */
  receiver: CallReceiver;
  
  // Required methods
  updateStatus(status: string): void;
  setId(id: string): void;
  setChannel(channel: string | null): void;
  getChannel(): string | null;
  hasChannel(): boolean;
  isActive(): boolean;
  isTerminated(): boolean;
  isOffered(): boolean;
  includesPhone(phone: Phone): boolean;
  getAllPhones(): Phone[];
  getReceiverDisplayName(): string;
  getReceiverNames(): string;
  toEmittable(): any;
  toString(): string;
}

export class PreparedCall implements ICall {
    static TYPES = { "P2P": "p2p", "GROUP": "group", "REC": "REC" };
    static LEVELS = { "NORMAL": "normal", "URGENT": "urgent", "EMERGENCY": "emergency" };
    static STATUS = { 
      // Simple call states (P2P calls)
      "OFFERED": "offered", 
      "ACCEPTED": "accepted", 
      "REJECTED": "rejected", 
      "ENDED": "ended",
      
      // VGCS states (Group/REC calls)
      "N0_NULL": "N0_NULL",
      "N1_INITIATED": "N1_INITIATED", 
      "N3_ESTABLISHING": "N3_ESTABLISHING",
      "N2_ACTIVE": "N2_ACTIVE",
      "N4_TERMINATING": "N4_TERMINATING"
    };

    // ICall interface properties
    id: string;
    timePlaced: number;
    level: string;
    status: string;
    type: string;
    channel: string | null = null;
    
    // Clean, unified properties - no more target vs receivers confusion!
    sender: Phone;
    receiver: CallReceiver;  // Either Phone (P2P) or CallGroup (GROUP/REC)
    
    constructor(sender: Phone, receiver: CallReceiver, type: string = PreparedCall.TYPES.P2P, level: string = PreparedCall.LEVELS.NORMAL, id?: string) {
      // ID should be assigned by server, only generate temporary ID if not provided
      this.id = id || `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      this.timePlaced = Date.now();
      this.sender = sender;
      this.receiver = receiver;
      this.type = type;
      this.level = level;
      this.status = PreparedCall.STATUS.OFFERED;
    }

    // ICall interface method implementations
    updateStatus(status: string): void {
      if (!Object.values(PreparedCall.STATUS).includes(status)) {
        throw new Error(`Invalid status: ${status}`);
      }
      this.status = status;
    }

    setId(id: string): void {
      this.id = id;
    }

    setChannel(channel: string | null): void {
      this.channel = channel;
    }

    getChannel(): string | null {
      return this.channel;
    }

    hasChannel(): boolean {
      return this.channel !== null && this.channel !== undefined;
    }

    isActive(): boolean {
      return this.status === PreparedCall.STATUS.ACCEPTED || 
             this.status === PreparedCall.STATUS.N2_ACTIVE;
    }

    isTerminated(): boolean {
      return this.status === PreparedCall.STATUS.ENDED || 
             this.status === PreparedCall.STATUS.REJECTED ||
             this.status === PreparedCall.STATUS.N0_NULL;
    }

    isOffered(): boolean {
      return this.status === PreparedCall.STATUS.OFFERED ||
             this.status === PreparedCall.STATUS.N1_INITIATED;
    }

    includesPhone(phone: Phone): boolean {
      // Check sender
      if (this.sender.id === phone.id) return true;
      
      // Check receiver
      if (this.receiver instanceof Phone) {
        return this.receiver.id === phone.id;
      }
      
      // Check group members (CallGroup)
      return this.receiver.members.some(member => member.id === phone.id);
    }

    getAllPhones(): Phone[] {
      // P2P call: sender + receiver phone
      if (this.receiver instanceof CallGroupClass) {
        // GROUP/REC call: sender + all group members (converted to Phone objects)
        const groupMembers = this.receiver.members.map(member => ({
          id: member.id,
          name: member.name,
          type: member.type
        } as Phone));
        
        return [this.sender, ...groupMembers];
      }
      
      // P2P call: sender + receiver phone
      return [this.sender, this.receiver];
    }

    /**
     * Get display name for the receiver (Phone name or Group name)
     */
    getReceiverDisplayName(): string {
      if (this.receiver instanceof CallGroupClass) {
        return this.receiver.getDisplayName();
      }
      return this.receiver.name;
    }

    /**
     * Get all receiver names for UI display
     */
    getReceiverNames(): string {
      if (this.receiver instanceof CallGroupClass) {
        return this.receiver.getMemberNames();
      }
      return this.receiver.name;
    }

    toEmittable(): any {
      return {
        id: this.id,
        timePlaced: this.timePlaced,
        level: this.level,
        status: this.status,
        type: this.type,
        channel: this.channel,
        sender: this.sender,
        receiver: this.receiver instanceof CallGroupClass 
          ? this.receiver.toSimple() 
          : this.receiver
      };
    }

    toString(): string {
      const receiverName = this.getReceiverDisplayName();
      return `PreparedCall[${this.id}] ${this.type} ${this.status} from ${this.sender.name} to ${receiverName}`;
    }
}
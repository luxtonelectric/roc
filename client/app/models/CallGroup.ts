export interface CallGroupMember {
  id: string;
  name: string;
  type: string;
  status?: 'available' | 'busy' | 'offline';
}

/**
 * CallGroup represents a predefined calling group for GROUP and REC calls
 * This eliminates the need for Phone array passing and provides rich group information
 */
export default class CallGroup {
  static TYPES = {
    GROUP: "group",
    REC: "REC"
  };

  id: string;
  name: string;
  description: string;
  type: string;
  simId: string;
  members: CallGroupMember[];
  
  constructor(
    id: string, 
    name: string, 
    description: string, 
    type: string, 
    simId: string,
    members: CallGroupMember[] = []
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.type = type;
    this.simId = simId;
    this.members = members;
  }

  /**
   * Get display name for UI (includes member count)
   */
  getDisplayName(): string {
    return `${this.name} (${this.members.length} members)`;
  }

  /**
   * Get available members only
   */
  getAvailableMembers(): CallGroupMember[] {
    return this.members.filter(member => 
      member.status !== 'offline' && member.status !== 'busy'
    );
  }

  /**
   * Check if group has any available members
   */
  hasAvailableMembers(): boolean {
    return this.getAvailableMembers().length > 0;
  }

  /**
   * Get member names for display
   */
  getMemberNames(): string {
    return this.members.map(m => m.name).join(', ');
  }

  /**
   * Convert to simple format for server communication
   */
  toSimple(): any {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      type: this.type,
      simId: this.simId,
      members: this.members,
      memberCount: this.members.length
    };
  }

  /**
   * Create CallGroup from server data
   */
  static fromSimple(data: any): CallGroup {
    return new CallGroup(
      data.id,
      data.name,
      data.description,
      data.type,
      data.simId,
      data.members || []
    );
  }

  toString(): string {
    return `CallGroup[${this.id}] ${this.name} (${this.type}) - ${this.members.length} members`;
  }
}

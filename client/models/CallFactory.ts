import type Phone from './Phone';
import type CallGroup from './CallGroup';
import CallGroupClass from './CallGroup';
import type { ICall } from './PreparedCall';
import { PreparedCall, type CallReceiver } from './PreparedCall';
import type { IP2PCall, IGroupCall, IRECCall, AnyCall } from './CallTypeGuards';

/**
 * Client-side call factory for proper type instantiation
 * Provides centralized call creation with type safety and validation
 */

export interface CallFactoryOptions {
  id?: string;
  timePlaced?: number;
  status?: string;
  channel?: string | null;
}

/**
 * Factory class for creating different types of calls
 */
export class CallFactory {
  
  /**
   * Create a P2P call
   * @param sender - Phone making the call
   * @param receiver - Phone receiving the call
   * @param level - Call priority level
   * @param options - Additional options
   * @returns P2P call instance
   */
  static createP2PCall(
    sender: Phone, 
    receiver: Phone, 
    level: string = PreparedCall.LEVELS.NORMAL,
    options: CallFactoryOptions = {}
  ): IP2PCall {
    const call = new PreparedCall(
      sender, 
      receiver, 
      PreparedCall.TYPES.P2P, 
      level
    );
    
    // Apply options if provided
    if (options.id) call.id = options.id;
    if (options.timePlaced) call.timePlaced = options.timePlaced;
    if (options.status) call.updateStatus(options.status);
    if (options.channel !== undefined) call.setChannel(options.channel);
    
    return call as IP2PCall;
  }

  /**
   * Create a Group call
   * @param sender - Phone initiating the call
   * @param receiver - CallGroup representing the group being called
   * @param level - Call priority level
   * @param options - Additional options
   * @returns Group call instance
   */
  static createGroupCall(
    sender: Phone,
    receiver: CallGroup,
    level: string = PreparedCall.LEVELS.NORMAL,
    options: CallFactoryOptions = {}
  ): IGroupCall {
    const call = new PreparedCall(
      sender, 
      receiver, 
      PreparedCall.TYPES.GROUP, 
      level
    );
    
    // Set appropriate initial status for VGCS calls
    if (!options.status) {
      call.updateStatus(PreparedCall.STATUS.N1_INITIATED);
    }
    
    // Apply options if provided
    if (options.id) call.id = options.id;
    if (options.timePlaced) call.timePlaced = options.timePlaced;
    if (options.status) call.updateStatus(options.status);
    if (options.channel !== undefined) call.setChannel(options.channel);
    
    return call as IGroupCall;
  }

  /**
   * Create a REC (Railway Emergency Call) call
   * @param sender - Phone initiating the emergency call
   * @param receiver - CallGroup representing the emergency response group
   * @param options - Additional options
   * @returns REC call instance
   */
  static createRECCall(
    sender: Phone,
    receiver: CallGroup,
    options: CallFactoryOptions = {}
  ): IRECCall {
    const call = new PreparedCall(
      sender, 
      receiver, 
      PreparedCall.TYPES.REC, 
      PreparedCall.LEVELS.EMERGENCY // REC calls are always emergency level
    );
    
    // Set appropriate initial status for VGCS calls
    if (!options.status) {
      call.updateStatus(PreparedCall.STATUS.N1_INITIATED);
    }
    
    // Apply options if provided
    if (options.id) call.id = options.id;
    if (options.timePlaced) call.timePlaced = options.timePlaced;
    if (options.status) call.updateStatus(options.status);
    if (options.channel !== undefined) call.setChannel(options.channel);
    
    return call as IRECCall;
  }

  /**
   * Create a call from emitted data (from server)
   * @param data - Call data from server emission
   * @returns Appropriate call type instance
   */
  static fromEmittedData(data: any): AnyCall {
    if (!data.type) {
      throw new Error('Call data must include type');
    }

    if (!data.sender || !data.receiver) {
      throw new Error('Call data must include sender and receiver');
    }

    const options: CallFactoryOptions = {
      id: data.id,
      timePlaced: data.timePlaced,
      status: data.status,
      channel: data.channel
    };

    // Parse receiver based on call type
    let receiver: CallReceiver;
    
    if (data.type === PreparedCall.TYPES.P2P) {
      // P2P calls have Phone receiver
      receiver = data.receiver as Phone;
      return CallFactory.createP2PCall(
        data.sender,
        receiver,
        data.level || PreparedCall.LEVELS.NORMAL,
        options
      );
    } else {
      // GROUP/REC calls have CallGroup receiver
      const callGroup = CallGroupClass.fromSimple(data.receiver);
      
      if (data.type === PreparedCall.TYPES.GROUP) {
        return CallFactory.createGroupCall(
          data.sender,
          callGroup,
          data.level || PreparedCall.LEVELS.NORMAL,
          options
        );
      } else if (data.type === PreparedCall.TYPES.REC) {
        return CallFactory.createRECCall(
          data.sender,
          callGroup,
          options
        );
      } else {
        throw new Error(`Unknown call type: ${data.type}`);
      }
    }
  }

  /**
   * Validate call data before creation (unified architecture)
   * @param sender - Sender phone
   * @param receiver - CallReceiver (Phone for P2P, CallGroup for GROUP/REC)
   * @param type - Call type
   * @param level - Call level
   * @returns True if data is valid
   */
  static validateCallData(
    sender: Phone,
    receiver: CallReceiver,
    type: string,
    level: string
  ): boolean {
    // Validate sender
    if (!sender || !sender.id) {
      console.error('Invalid sender phone');
      return false;
    }

    // Validate receiver
    if (!receiver) {
      console.error('Invalid receiver');
      return false;
    }

    // Validate type
    if (!Object.values(PreparedCall.TYPES).includes(type)) {
      console.error(`Invalid call type: ${type}`);
      return false;
    }

    // Validate level
    if (!Object.values(PreparedCall.LEVELS).includes(level)) {
      console.error(`Invalid call level: ${level}`);
      return false;
    }

    // Type-specific receiver validation
    switch (type) {
      case PreparedCall.TYPES.P2P:
        // P2P calls must have Phone receiver (no members property)
        if ('members' in receiver) {
          console.error('P2P calls require a Phone receiver, not CallGroup');
          return false;
        }
        if (!(receiver as Phone).id) {
          console.error('P2P receiver phone has invalid ID');
          return false;
        }
        break;

      case PreparedCall.TYPES.GROUP:
        // GROUP calls must have CallGroup receiver (has members property)
        if (!('members' in receiver)) {
          console.error('GROUP calls require a CallGroup receiver, not Phone');
          return false;
        }
        break;

      case PreparedCall.TYPES.REC:
        // REC calls must have CallGroup receiver (has members property)
        if (!('members' in receiver)) {
          console.error('REC calls require a CallGroup receiver, not Phone');
          return false;
        }
        // REC calls must be emergency level
        if (level !== PreparedCall.LEVELS.EMERGENCY) {
          console.error('REC calls must be emergency level');
          return false;
        }
        break;

      default:
        console.error(`Unknown call type for validation: ${type}`);
        return false;
    }

    return true;
  }
}
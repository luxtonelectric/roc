import { jest } from '@jest/globals';
import UnifiedCallManager from '../../src/UnifiedCallManager.js';
import ROCManager from '../../src/ROCManager.js';
import DiscordBot from '../../src/bot.js';
import PhoneManager from '../../src/phonemanager.js';
import Phone from '../../src/model/phone.js';
import Player from '../../src/model/player.js';
import Location from '../../src/model/location.js';
import BaseCall from '../../src/model/BaseCall.js';

import { createFakeDiscordClient } from './helpers/fakeDiscordClient.js';
import { createIoMock } from './helpers/ioMock.js';
import { callSockets } from '../../src/callSockets.js';

// E2E: two players claim panels and place a P2P call (real ROCManager & DiscordBot)
describe('E2E P2P call flow', () => {
  let phoneManager, fakeClient, ioMock, bot, roc, ucm, socketA, socketB;

  beforeEach(() => {
    // Minimal simulation loader stub to satisfy PhoneManager constructor
    const simulationLoaderStub = { loadSimulation: () => null, getSimulationMetadata: () => [] };
    phoneManager = new PhoneManager(simulationLoaderStub);

    // Create two phones and add to phoneManager
    const phone1 = new Phone('sim1_panelA', 'Panel A', Phone.TYPES.FIXED, new Location('sim1', 'panelA'));
    const phone2 = new Phone('sim1_panelB', 'Panel B', Phone.TYPES.FIXED, new Location('sim1', 'panelB'));
    phoneManager.phones.push(phone1, phone2);

    // Create players and assign
    const playerA = new Player(null, 'discordA', null);
    const playerB = new Player(null, 'discordB', null);
    phoneManager.assignPhone(phone1, playerA);
    phoneManager.assignPhone(phone2, playerB);

    // Setup fake Discord client and io
    fakeClient = createFakeDiscordClient();
    ioMock = createIoMock();

    // Real bot with fake client
    bot = new DiscordBot('token', '!', 'GUILD_ID', fakeClient);
    // Ensure there's at least one private call channel available
    bot.privateCallChannels = [{ id: 'pcc-1', reserved: false, inUse: false }];

    // Spy bot movements
    jest.spyOn(bot, 'setUserVoiceChannel');

    // Real ROCManager
    roc = new ROCManager(ioMock, bot, phoneManager, null, null, null);

    // Register two users with sockets (rich mock with updateVoiceChannel support)
    const makeUser = (discordId, socketId) => ({
      socket: { id: socketId, disconnected: false, emit: jest.fn() },
      discordId,
      voiceChannelId: null,
      updateVoiceChannel(channel) { this.voiceChannelId = channel; }
    });

    roc.users = {
      discordA: makeUser('discordA', 'socketA'),
      discordB: makeUser('discordB', 'socketB')
    };

    // UnifiedCallManager
    ucm = new UnifiedCallManager(phoneManager, bot, ioMock, roc);
    roc.setCallManager(ucm);
    bot.setGameManager(roc);

    // Create fake socket objects and wire socket handlers (callSockets)
    const makeFakeSocket = (id) => {
      const handlers = new Map();
      return {
        id,
        disconnected: false,
        on: (ev, handler) => handlers.set(ev, handler),
        emit: (ev, data) => ioMock.events.push({ to: id, ev, data }),
        // trigger simulates client -> server socket emission
        trigger: async (ev, msg, callback) => {
          const handler = handlers.get(ev);
          if (!handler) throw new Error(`No handler registered for event: ${ev}`);
          // call handler like socket.io would: handler(msg, callback)
          return await handler(msg, callback);
        }
      };
    };

    // Attach sockets for two users
    socketA = makeFakeSocket('socketA');
    socketB = makeFakeSocket('socketB');
    callSockets(socketA, ucm, roc);
    callSockets(socketB, ucm, roc);

    // Expose sockets on roc users so code that uses socket objects can find them
    roc.users.discordA.socket = socketA;
    roc.users.discordB.socket = socketB;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('players place, accept and terminate a P2P call', async () => {
    // Ensure both members appear to be in voice channels (validator requires this)
    fakeClient.__helpers.setMemberVoiceChannel('discordA', 'vc-A');
    fakeClient.__helpers.setMemberVoiceChannel('discordB', 'vc-B');

    // Record original voice channels in ROCManager so termination can move users back
    roc.users.discordA.voiceChannelId = 'vc-A';
    roc.users.discordB.voiceChannelId = 'vc-B';

    // Prepare a private call channel in the fake guild and attach members so termination can use it
    fakeClient.__helpers.addChannel('pcc-1', 'Private Call 1');
    const guild = await fakeClient.guilds.fetch('GUILD_ID');
    const memberA = await guild.members.fetch('discordA');
    const memberB = await guild.members.fetch('discordB');
    const channelObj = await guild.channels.fetch('pcc-1');
    // Attach members to the channel object in the shape terminateCallForChannel expects
    channelObj.members = new Map([[memberA.id, memberA], [memberB.id, memberB]]);

    // Place P2P call from phone1 to phone2 via socket event
    const callId = await new Promise(resolve => socketA.trigger('placeCall', {
      sender: 'sim1_panelA',
      receiver: 'sim1_panelB',
      type: BaseCall.TYPES.P2P,
      level: BaseCall.LEVELS.NORMAL
    }, (response) => resolve(response)));

    // Ensure the socket-based place emitted the same outcome (requested call exists)

    expect(callId).toBeTruthy();
    expect(ucm.requestedCalls.has(callId)).toBe(true);

    // Accept the call as player B via socket event
    const acceptResult = await new Promise(resolve => socketB.trigger('acceptCall', { id: callId }, (res) => resolve(res)));
    expect(acceptResult).toBe(true);

    // Call should now be active and accepted
    const call = ucm.activeCalls.get(callId);
    expect(call).toBeDefined();
    expect(call.status).toBe(BaseCall.STATUS.ACCEPTED);

    // Bot should have been asked to move players (setUserVoiceChannel should have been invoked)
    expect(bot.setUserVoiceChannel).toHaveBeenCalledTimes(2);

    // Both members should now be in the private call channel
    const guildAfter = await fakeClient.guilds.fetch('GUILD_ID');
    const memberAAfter = await guildAfter.members.fetch('discordA');
    const memberBAfter = await guildAfter.members.fetch('discordB');
    expect(memberAAfter.voice.channel.id).toBe('pcc-1');
    expect(memberBAfter.voice.channel.id).toBe('pcc-1');

    // Simulate the first participant leaving the call via socket event (this should auto-terminate P2P calls)
    const leaveResult = await new Promise(resolve => socketA.trigger('leaveCall', { id: callId }, (res) => resolve(res)));
    // leaveCall socket handler returns an object { success: boolean }
    expect(leaveResult && leaveResult.success === true).toBe(true);

    // After termination, the call should be in pastCalls
    expect(ucm.pastCalls.has(callId)).toBe(true);

    // Players should be returned to their original voice channels
    const guildAfterTerm = await fakeClient.guilds.fetch('GUILD_ID');
    const memberAAfterTerm = await guildAfterTerm.members.fetch('discordA');
    const memberBAfterTerm = await guildAfterTerm.members.fetch('discordB');
    expect(memberAAfterTerm.voice.channel.id).toBe('vc-A');
    expect(memberBAfterTerm.voice.channel.id).toBe('vc-B');

    // Private channel should have been released back to pool
    const channelEntry = bot.privateCallChannels.find(c => c.id === 'pcc-1');
    expect(channelEntry).toBeDefined();
    expect(channelEntry.reserved).toBe(false);
    expect(channelEntry.inUse).toBe(false);

    // Validate socket emissions occurred (call updates sent)
    const foundCallUpdate = ioMock.events.some(e => e.ev === 'callUpdate' || e.ev === 'callPlaced' || e.ev === 'callEnded');
    expect(foundCallUpdate).toBe(true);
  });

  test('players place, accept and auto-terminate when a participant leaves via Discord voice state update', async () => {
    // Ensure both members appear to be in voice channels
    fakeClient.__helpers.setMemberVoiceChannel('discordA', 'vc-A');
    fakeClient.__helpers.setMemberVoiceChannel('discordB', 'vc-B');

    // Record original voice channels
    roc.users.discordA.voiceChannelId = 'vc-A';
    roc.users.discordB.voiceChannelId = 'vc-B';

    // Prepare a private call channel
    fakeClient.__helpers.addChannel('pcc-1', 'Private Call 1');
    const guild = await fakeClient.guilds.fetch('GUILD_ID');
    const memberA = await guild.members.fetch('discordA');
    const memberB = await guild.members.fetch('discordB');
    const channelObj = await guild.channels.fetch('pcc-1');
    channelObj.members = new Map([[memberA.id, memberA], [memberB.id, memberB]]);

    // Place the call via socket A
    const callId = await new Promise(resolve => socketA.trigger('placeCall', {
      sender: 'sim1_panelA',
      receiver: 'sim1_panelB',
      type: BaseCall.TYPES.P2P,
      level: BaseCall.LEVELS.NORMAL
    }, (response) => resolve(response)));

    expect(callId).toBeTruthy();

    // Accept via socket B
    const acceptResult = await new Promise(resolve => socketB.trigger('acceptCall', { id: callId }, (res) => resolve(res)));
    expect(acceptResult).toBe(true);

    // Sanity: both in private call channel
    const guildAfter = await fakeClient.guilds.fetch('GUILD_ID');
    const memberAAfter = await guildAfter.members.fetch('discordA');
    const memberBAfter = await guildAfter.members.fetch('discordB');
    expect(memberAAfter.voice.channel.id).toBe('pcc-1');
    expect(memberBAfter.voice.channel.id).toBe('pcc-1');

    // Simulate Discord voiceStateUpdate: discordA leaves voice (remove from channel members first)
    channelObj.members.delete('discordA');
    // Update the member object to reflect they've left voice
    memberA.voice.channel = null;
    const oldState = { id: 'discordA', channelId: 'pcc-1', channel: channelObj };
    const newState = { id: 'discordA', channelId: null, channel: null };

    // Call the bot handler to simulate leaving via Discord
    await bot.onVoiceStateUpdate(oldState, newState);
    // Allow asynchronous termination tasks to complete
    await new Promise(resolve => setTimeout(resolve, 20));

    // After termination, call should be in pastCalls
    expect(ucm.pastCalls.size).toBeGreaterThan(0);
    const found = Array.from(ucm.pastCalls.keys()).includes(callId);
    expect(found).toBe(true);

    // Both players should be returned to their original channels (or disconnected handled)
    const guildAfterTerm = await fakeClient.guilds.fetch('GUILD_ID');
    const memberAAfterTerm = await guildAfterTerm.members.fetch('discordA');
    const memberBAfterTerm = await guildAfterTerm.members.fetch('discordB');
    expect(memberAAfterTerm.voice.channel?.id === 'vc-A' || memberAAfterTerm.voice.channel === null).toBe(true);
    expect(memberBAfterTerm.voice.channel.id).toBe('vc-B');

    // Private channel should be released
    const channelEntry = bot.privateCallChannels.find(c => c.id === 'pcc-1');
    expect(channelEntry).toBeDefined();
    expect(channelEntry.reserved).toBe(false);
    expect(channelEntry.inUse).toBe(false);
  });

  test('players place, accept and auto-terminate when a participant moves back to a voice channel via Discord voice state update', async () => {
    // Ensure both members appear to be in voice channels
    fakeClient.__helpers.setMemberVoiceChannel('discordA', 'vc-A');
    fakeClient.__helpers.setMemberVoiceChannel('discordB', 'vc-B');

    // Record original voice channels
    roc.users.discordA.voiceChannelId = 'vc-A';
    roc.users.discordB.voiceChannelId = 'vc-B';

    // Prepare a private call channel and original channel in the fake guild
    fakeClient.__helpers.addChannel('pcc-1', 'Private Call 1');
    fakeClient.__helpers.addChannel('vc-A', 'Original Channel A');

    const guild = await fakeClient.guilds.fetch('GUILD_ID');
    const memberA = await guild.members.fetch('discordA');
    const memberB = await guild.members.fetch('discordB');
    const channelObj = await guild.channels.fetch('pcc-1');
    channelObj.members = new Map([[memberA.id, memberA], [memberB.id, memberB]]);

    // Place the call via socket A
    const callId = await new Promise(resolve => socketA.trigger('placeCall', {
      sender: 'sim1_panelA',
      receiver: 'sim1_panelB',
      type: BaseCall.TYPES.P2P,
      level: BaseCall.LEVELS.NORMAL
    }, (response) => resolve(response)));

    expect(callId).toBeTruthy();

    // Accept via socket B
    const acceptResult = await new Promise(resolve => socketB.trigger('acceptCall', { id: callId }, (res) => resolve(res)));
    expect(acceptResult).toBe(true);

    // Sanity: both in private call channel
    const guildAfter = await fakeClient.guilds.fetch('GUILD_ID');
    const memberAAfter = await guildAfter.members.fetch('discordA');
    const memberBAfter = await guildAfter.members.fetch('discordB');
    expect(memberAAfter.voice.channel.id).toBe('pcc-1');
    expect(memberBAfter.voice.channel.id).toBe('pcc-1');

    // Simulate Discord voiceStateUpdate: discordA moves back to their original channel (vc-A)
    channelObj.members.delete('discordA');
    // Ensure the target channel object exists and contains the member
    const vcAObj = await guild.channels.fetch('vc-A');
    vcAObj.members = new Map([[memberA.id, memberA]]);
    memberA.voice.channel = { id: 'vc-A' };

    const oldState = { id: 'discordA', channelId: 'pcc-1', channel: channelObj };
    const newState = { id: 'discordA', channelId: 'vc-A', channel: vcAObj };

    // Call the bot handler to simulate moving back via Discord
    await bot.onVoiceStateUpdate(oldState, newState);
    // Allow asynchronous termination tasks to complete
    await new Promise(resolve => setTimeout(resolve, 20));

    // After termination, the call should be in pastCalls
    const found2 = Array.from(ucm.pastCalls.keys()).includes(callId);
    expect(found2).toBe(true);

    // Player A should now be in vc-A and B should be in vc-B
    const guildAfterTerm = await fakeClient.guilds.fetch('GUILD_ID');
    const memberAAfterTerm = await guildAfterTerm.members.fetch('discordA');
    const memberBAfterTerm = await guildAfterTerm.members.fetch('discordB');
    expect(memberAAfterTerm.voice.channel.id).toBe('vc-A');
    expect(memberBAfterTerm.voice.channel.id).toBe('vc-B');

    // Private channel should be released
    const channelEntry2 = bot.privateCallChannels.find(c => c.id === 'pcc-1');
    expect(channelEntry2).toBeDefined();
    expect(channelEntry2.reserved).toBe(false);
    expect(channelEntry2.inUse).toBe(false);
  });

  test('urgent call preempts normal call and takes over private channel', async () => {
    // Add two more phones and players (C & D)
    const phone3 = new Phone('sim1_panelC', 'Panel C', Phone.TYPES.FIXED, new Location('sim1', 'panelC'));
    const phone4 = new Phone('sim1_panelD', 'Panel D', Phone.TYPES.FIXED, new Location('sim1', 'panelD'));
    phoneManager.phones.push(phone3, phone4);

    const playerC = new Player(null, 'discordC', null);
    const playerD = new Player(null, 'discordD', null);
    phoneManager.assignPhone(phone3, playerC);
    phoneManager.assignPhone(phone4, playerD);

    // Create sockets and wire handlers for C & D (local helper)
    const handlersC = new Map();
    const socketC = {
      id: 'socketC', disconnected: false,
      on: (ev, handler) => handlersC.set(ev, handler),
      emit: (ev, data) => ioMock.events.push({ to: 'socketC', ev, data }),
      trigger: async (ev, msg, callback) => { const h = handlersC.get(ev); if (!h) throw new Error(`No handler ${ev}`); return await h(msg, callback); }
    };
    const handlersD = new Map();
    const socketD = {
      id: 'socketD', disconnected: false,
      on: (ev, handler) => handlersD.set(ev, handler),
      emit: (ev, data) => ioMock.events.push({ to: 'socketD', ev, data }),
      trigger: async (ev, msg, callback) => { const h = handlersD.get(ev); if (!h) throw new Error(`No handler ${ev}`); return await h(msg, callback); }
    };
    callSockets(socketC, ucm, roc);
    callSockets(socketD, ucm, roc);
    roc.users.discordC = { socket: socketC, discordId: 'discordC', voiceChannelId: 'vc-C', updateVoiceChannel(channel) { this.voiceChannelId = channel; } };
    roc.users.discordD = { socket: socketD, discordId: 'discordD', voiceChannelId: 'vc-D', updateVoiceChannel(channel) { this.voiceChannelId = channel; } };

    // Ensure all members appear to be in voice channels
    fakeClient.__helpers.setMemberVoiceChannel('discordA', 'vc-A');
    fakeClient.__helpers.setMemberVoiceChannel('discordB', 'vc-B');
    fakeClient.__helpers.setMemberVoiceChannel('discordC', 'vc-C');
    fakeClient.__helpers.setMemberVoiceChannel('discordD', 'vc-D');

    // Record original voice channels
    roc.users.discordA.voiceChannelId = 'vc-A';
    roc.users.discordB.voiceChannelId = 'vc-B';
    roc.users.discordC.voiceChannelId = 'vc-C';
    roc.users.discordD.voiceChannelId = 'vc-D';

    // Prepare private channel and member objects
    fakeClient.__helpers.addChannel('pcc-1', 'Private Call 1');
    const guild = await fakeClient.guilds.fetch('GUILD_ID');
    const mA = await guild.members.fetch('discordA');
    const mB = await guild.members.fetch('discordB');
    const mC = await guild.members.fetch('discordC');
    const mD = await guild.members.fetch('discordD');
    const channelObj = await guild.channels.fetch('pcc-1');

    // 1) Place and accept first (normal) call between A & B
    const callAId = await new Promise(resolve => socketA.trigger('placeCall', {
      sender: 'sim1_panelA',
      receiver: 'sim1_panelB',
      type: BaseCall.TYPES.P2P,
      level: BaseCall.LEVELS.NORMAL
    }, (response) => resolve(response)));
    expect(callAId).toBeTruthy();

    const acceptA = await new Promise(resolve => socketB.trigger('acceptCall', { id: callAId }, (res) => resolve(res)));
    expect(acceptA).toBe(true);

    // Simulate participants moved into channel
    mA.voice.channel = { id: 'pcc-1' };
    mB.voice.channel = { id: 'pcc-1' };
    channelObj.members = new Map([[mA.id, mA], [mB.id, mB]]);

    // Mark private channel metadata for call A so it can be preempted
    const ch = bot.privateCallChannels.find(c => c.id === 'pcc-1');
    ch.inUse = true; ch.reserved = true; ch.callType = BaseCall.TYPES.P2P; ch.callLevel = BaseCall.LEVELS.NORMAL; ch.callId = callAId; ch.participantIds = [mA.id, mB.id];

    // 2) Place second (urgent) call between C & D
    const callBId = await new Promise(resolve => socketC.trigger('placeCall', {
      sender: 'sim1_panelC',
      receiver: 'sim1_panelD',
      type: BaseCall.TYPES.P2P,
      level: BaseCall.LEVELS.URGENT
    }, (response) => resolve(response)));
    expect(callBId).toBeTruthy();

    // Accept the urgent call which should preempt call A
    const acceptB = await new Promise(resolve => socketD.trigger('acceptCall', { id: callBId }, (res) => resolve(res)));
    expect(acceptB).toBe(true);

    // After acceptance, call A should be terminated and in pastCalls
    expect(ucm.pastCalls.has(callAId)).toBe(true);

    // Call B should now be active and using the private channel
    const callB = ucm.activeCalls.get(callBId);
    expect(callB).toBeDefined();
    expect(callB.channel).toBe('pcc-1');

    // Private channel should reflect usage by callB (inUse or reserved true)
    expect(ch.reserved || ch.inUse).toBe(true);

    // Optionally, verify participants for B are now in the channel
    mC.voice.channel = { id: 'pcc-1' };
    mD.voice.channel = { id: 'pcc-1' };
    channelObj.members = new Map([[mC.id, mC], [mD.id, mD]]);

  });
});

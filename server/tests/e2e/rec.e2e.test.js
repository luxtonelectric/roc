import { jest } from '@jest/globals';
import UnifiedCallManager from '../../src/UnifiedCallManager.js';
import ROCManager from '../../src/ROCManager.js';
import DiscordBot from '../../src/bot.js';
import PhoneManager from '../../src/phonemanager.js';
import Phone from '../../src/model/phone.js';
import Player from '../../src/model/player.js';
import Location from '../../src/model/location.js';
import BaseCall from '../../src/model/BaseCall.js';
import CallGroup from '../../src/model/CallGroup.js';

import { createFakeDiscordClient } from './helpers/fakeDiscordClient.js';
import { createIoMock } from './helpers/ioMock.js';
import { callSockets } from '../../src/callSockets.js';

// E2E: one player initiates a REC call and a neighbouring panel joins
describe('E2E REC call flow', () => {
  let phoneManager, fakeClient, ioMock, bot, roc, ucm, socketA, socketB;

  beforeEach(() => {
    const simulationLoaderStub = { loadSimulation: () => null, getSimulationMetadata: () => [] };
    phoneManager = new PhoneManager(simulationLoaderStub);

    // Create two phones (sender A and neighbouring panel B)
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
        trigger: async (ev, msg, callback) => {
          const handler = handlers.get(ev);
          if (!handler) throw new Error(`No handler registered for event: ${ev}`);
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

  afterEach(async () => {
    // Terminate any active or requested calls so VGCS timers get cleared
    try {
      for (const callId of Array.from(ucm.activeCalls.keys())) {
        await ucm.terminateCall(null, callId, 'TEST_CLEANUP');
      }
      for (const callId of Array.from(ucm.requestedCalls.keys())) {
        try { await ucm.terminateCall(null, callId, 'TEST_CLEANUP'); } catch (e) {}
      }

      // Clear mobile station timers
      for (const ms of ucm.mobileStations.values()) {
        if (ms._presentTimer) clearTimeout(ms._presentTimer);
        if (ms._idleTimer) clearTimeout(ms._idleTimer);
      }

      // Clear network timers on bus
      if (ucm.vgcsBus && ucm.vgcsBus.networks) {
        for (const network of ucm.vgcsBus.networks.values()) {
          if (network._presentTimer) clearTimeout(network._presentTimer);
          if (network._setupTimer) clearTimeout(network._setupTimer);
          if (network._idleTimer) clearTimeout(network._idleTimer);
        }
      }
    } catch (err) {
      // ignore cleanup errors
    } finally {
      jest.restoreAllMocks();
    }
  });

  test('sender places REC call and neighbour joins', async () => {
    // Ensure both members appear to be in voice channels (validator requires this)
    fakeClient.__helpers.setMemberVoiceChannel('discordA', 'vc-A');
    fakeClient.__helpers.setMemberVoiceChannel('discordB', 'vc-B');

    // Record original voice channels in ROCManager so termination can move users back
    roc.users.discordA.voiceChannelId = 'vc-A';
    roc.users.discordB.voiceChannelId = 'vc-B';

    // Prepare a private call channel in the fake guild
    fakeClient.__helpers.addChannel('pcc-1', 'Private Call 1');
    const guild = await fakeClient.guilds.fetch('GUILD_ID');
    const memberA = await guild.members.fetch('discordA');
    const memberB = await guild.members.fetch('discordB');
    const channelObj = await guild.channels.fetch('pcc-1');

    // Ensure phoneManager can resolve REC recipients via simulation structure
    phoneManager.sims = [
      {
        id: 'sim1',
        getPanel(panelId) {
          if (panelId === 'panelA') return { id: 'panelA', neighbours: [{ simId: 'sim1', panelId: 'panelB' }] };
          if (panelId === 'panelB') return { id: 'panelB', neighbours: [{ simId: 'sim1', panelId: 'panelA' }] };
          return null;
        }
      }
    ];

    // Place REC call from phone1 via socket event
    // callSockets.placeCall requires a truthy receiver for non-REC calls - for REC we omit receiver
    const callId = await new Promise(resolve => socketA.trigger('placeCall', {
      sender: 'sim1_panelA',
      // no receiver field for REC
      type: BaseCall.TYPES.REC,
      level: BaseCall.LEVELS.EMERGENCY
    }, (response) => resolve(response)));

    expect(callId).toBeTruthy();
    expect(ucm.requestedCalls.has(callId)).toBe(true);

    // Get the call and verify participants auto-populated
    const call = ucm.requestedCalls.get(callId);
    expect(call).toBeDefined();

    // Allow asynchronous VGCS/channel allocation and callbacks to complete
    await new Promise(resolve => setTimeout(resolve, 300));

    // Neighbour should be recorded as a participant on the call (auto-populated)
    expect(Array.from(call.participants || []).some(p => p.getId() === 'sim1_panelB')).toBe(true);

    // Phone-to-call mapping should be set for the neighbour (station created on join)
    expect(ucm.phoneToCallMap.get('sim1_panelB')).toBe(callId);

    // Now simulate the neighbour accepting / joining the group call via socket
    const joinResult = await new Promise(resolve => socketB.trigger('joinGroupCall', { groupId: callId }, (res) => resolve(res)));
    expect(joinResult).toBe(true);

    // --- New scenario: attempt REC from a sender that has no available (claimed) recipients ---
    // Create a separate simulation with a neighbour that is not claimed (no Discord IDs)
    // Sim structure with panels and neighbours
    const lonelySim = {
      id: 'lonelySim',
      getPanel(panelId) {
        if (panelId === 'origin') return { id: 'origin', neighbours: [{ simId: 'lonelySim', panelId: 'neighbor1' }] };
        if (panelId === 'neighbor1') return { id: 'neighbor1', neighbours: [{ simId: 'lonelySim', panelId: 'origin' }] };
        return null;
      }
    };

    // Create origin and neighbor phones and add to phoneManager
    const originPhone = new Phone('lonelySim_origin', 'Origin', Phone.TYPES.FIXED, new Location('lonelySim', 'origin'));
    const neighborPhone = new Phone('lonelySim_neighbor1', 'Neighbor', Phone.TYPES.FIXED, new Location('lonelySim', 'neighbor1'));
    phoneManager.phones.push(originPhone, neighborPhone);

    // Assign a player to the origin so it passes sender validation
    const originPlayer = new Player(null, 'lonely-discord', null);
    phoneManager.assignPhone(originPhone, originPlayer);

    // Ensure the origin appears in voice so CallValidator passes
    fakeClient.__helpers.setMemberVoiceChannel('lonely-discord', 'vc-lonely');

    // Register the simulation in phoneManager (so getRECRecipientsForPhone can find panels)
    phoneManager.sims = phoneManager.sims || [];
    phoneManager.sims.push(lonelySim);

    // Place REC call from the origin via socket - should be rejected because neighbour is unassigned
    const rejectedResult = await new Promise(resolve => socketA.trigger('placeCall', {
      sender: 'lonelySim_origin',
      type: BaseCall.TYPES.REC,
      level: BaseCall.LEVELS.EMERGENCY
    }, (response) => resolve(response)));

    expect(rejectedResult).toBeNull();

    // The initiating socket should have been notified with a callError containing our message
    const errorEvent = ioMock.events.find(e => e.ev === 'callError' && e.to === 'socketA');
    expect(errorEvent).toBeDefined();
    expect(errorEvent.data).toBeDefined();
    expect(errorEvent.data.error).toEqual(expect.stringContaining('No available REC recipients'));

    // Wait a little longer to allow any background tasks to finish before test exit
    await new Promise(resolve => setTimeout(resolve, 250));
  });

  test('REC call rejected when only recipients are owned by sender', async () => {
    // Both panels are in voice channels
    fakeClient.__helpers.setMemberVoiceChannel('discordA', 'vc-A');
    roc.users.discordA.voiceChannelId = 'vc-A';

    // Reassign neighbouring panel B to the same player as sender A
    const phoneB = phoneManager.getPhone('sim1_panelB');
    expect(phoneB).toBeDefined();
    const playerA = phoneManager.getPhonesForDiscordId('discordA')[0] || new Player(null, 'discordA', null);
    phoneManager.assignPhone(phoneB, playerA);

    // Place REC call from phone1 - should be rejected because neighbour is same-owner
    const rejected = await new Promise(resolve => socketA.trigger('placeCall', {
      sender: 'sim1_panelA',
      type: BaseCall.TYPES.REC,
      level: BaseCall.LEVELS.EMERGENCY
    }, (res) => resolve(res)));

    expect(rejected).toBeNull();
    const errorEvent = ioMock.events.find(e => e.ev === 'callError' && e.to === 'socketA');
    expect(errorEvent).toBeDefined();
    expect(errorEvent.data.error).toEqual(expect.stringContaining('No available REC recipients'));
  });

  test('GROUP call rejected when recipients are all owned by sender', async () => {
    // Both panels in voice
    fakeClient.__helpers.setMemberVoiceChannel('discordA', 'vc-A');
    roc.users.discordA.voiceChannelId = 'vc-A';

    // Create a CallGroup containing panelB only
    const cg = new CallGroup('test-group-1', 'Test Group', 'Test group', CallGroup.TYPES.GROUP, 'sim1', [
      { id: 'sim1_panelB', name: 'Panel B', type: 'fixed', status: 'available' }
    ]);

    phoneManager.addCallGroup(cg);

    // Ensure panelB is assigned to same player as sender
    const playerA = phoneManager.getPhonesForDiscordId('discordA')[0] || new Player(null, 'discordA', null);
    phoneManager.assignPhone(phoneManager.getPhone('sim1_panelB'), playerA);

    const groupResult = await new Promise(resolve => socketA.trigger('placeCall', {
      sender: 'sim1_panelA',
      receiver: 'test-group-1',
      type: BaseCall.TYPES.GROUP,
      level: BaseCall.LEVELS.NORMAL
    }, (res) => resolve(res)));

    expect(groupResult).toBeNull();
    const groupError = ioMock.events.find(e => e.ev === 'callError' && e.to === 'socketA');
    expect(groupError).toBeDefined();
    expect(groupError.data.error).toEqual(expect.stringContaining('No available group recipients'));
  });


  test('REC call from unassigned phone is rejected and user notified', async () => {
    // Create an unassigned phone
    const phone3 = new Phone('sim1_panelC', 'Panel C', Phone.TYPES.FIXED, new Location('sim1', 'panelC'));
    phoneManager.phones.push(phone3);

    // Try to place REC call from the unassigned phone
    const result = await new Promise(resolve => socketA.trigger('placeCall', {
      sender: 'sim1_panelC',
      receiver: {},
      type: BaseCall.TYPES.REC,
      level: BaseCall.LEVELS.EMERGENCY
    }, (res) => resolve(res)));

    // Should be rejected (null returned)
    expect(result).toBeNull();

    // No requested call should be created for the unassigned phone
    const foundCall = Array.from(ucm.requestedCalls.values()).some(c => c.sender && c.sender.getId && c.sender.getId() === 'sim1_panelC');
    expect(foundCall).toBe(false);

    // The client socket should have received a callError notification
    const errorEvent = ioMock.events.find(e => e.ev === 'callError' && e.to === 'socketA');
    expect(errorEvent).toBeDefined();
    expect(errorEvent.data).toBeDefined();
    expect(errorEvent.data.error).toEqual(expect.stringContaining('Sender phone not assigned'));
  });

});

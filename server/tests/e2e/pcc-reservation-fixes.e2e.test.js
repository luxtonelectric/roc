import { jest } from '@jest/globals';
import DiscordBot from '../../src/bot.js';
import UnifiedCallManager from '../../src/UnifiedCallManager.js';
import ROCManager from '../../src/ROCManager.js';
import PhoneManager from '../../src/phonemanager.js';
import Phone from '../../src/model/phone.js';
import Player from '../../src/model/player.js';
import Location from '../../src/model/location.js';
import BaseCall from '../../src/model/BaseCall.js';

import { createFakeDiscordClient } from './helpers/fakeDiscordClient.js';
import { createIoMock } from './helpers/ioMock.js';
import { callSockets } from '../../src/callSockets.js';

describe('PCC reservation fixes (TDD)', () => {
  test('acceptP2PCall releases reservation when moves fail', async () => {
    const simulationLoaderStub = { loadSimulation: () => null, getSimulationMetadata: () => [] };
    const phoneManager = new PhoneManager(simulationLoaderStub);
    const phone1 = new Phone('sim1_panelA', 'Panel A', Phone.TYPES.FIXED, new Location('sim1', 'panelA'));
    const phone2 = new Phone('sim1_panelB', 'Panel B', Phone.TYPES.FIXED, new Location('sim1', 'panelB'));
    phoneManager.phones.push(phone1, phone2);
    const playerA = new Player(null, 'discordA', null);
    const playerB = new Player(null, 'discordB', null);
    phoneManager.assignPhone(phone1, playerA);
    phoneManager.assignPhone(phone2, playerB);

    const fakeClient = createFakeDiscordClient();
    const ioMock = createIoMock();
    const bot = new DiscordBot('token', '!', 'GUILD_ID', fakeClient);
    bot.privateCallChannels = [{ id: 'pcc-1', reserved: false, inUse: false }];

    // Force move to fail
    jest.spyOn(bot, 'setUserVoiceChannel').mockResolvedValue(false);

    const roc = new ROCManager(ioMock, bot, phoneManager, null, null, null);

    const makeUser = (discordId, socketId) => ({ socket: { id: socketId, disconnected: false, emit: jest.fn() }, discordId, voiceChannelId: null, updateVoiceChannel(channel) { this.voiceChannelId = channel; } });
    roc.users = { discordA: makeUser('discordA', 'socketA'), discordB: makeUser('discordB', 'socketB') };

    const ucm = new UnifiedCallManager(phoneManager, bot, ioMock, roc);
    roc.setCallManager(ucm);
    bot.setGameManager(roc);

    const makeFakeSocket = (id) => { const handlers = new Map(); return { id, disconnected: false, on: (ev, handler) => handlers.set(ev, handler), emit: (ev, data) => ioMock.events.push({ to: id, ev, data }), trigger: async (ev, msg, callback) => { const handler = handlers.get(ev); if (!handler) throw new Error(`No handler registered for event: ${ev}`); return await handler(msg, callback); } } };
    const socketA = makeFakeSocket('socketA');
    const socketB = makeFakeSocket('socketB');
    callSockets(socketA, ucm, roc);
    callSockets(socketB, ucm, roc);
    roc.users.discordA.socket = socketA;
    roc.users.discordB.socket = socketB;

    // Make sure members appear in discord voice so placeCall succeeds
    fakeClient.__helpers.setMemberVoiceChannel('discordA', 'vc-A');
    fakeClient.__helpers.setMemberVoiceChannel('discordB', 'vc-B');

    // Place call
    const callId = await new Promise(resolve => socketA.trigger('placeCall', { sender: 'sim1_panelA', receiver: 'sim1_panelB', type: BaseCall.TYPES.P2P, level: BaseCall.LEVELS.NORMAL }, (res) => resolve(res)));
    expect(callId).toBeTruthy();

    // Accept should fail since move fails and code should release the reservation
    const accept = await new Promise(resolve => socketB.trigger('acceptCall', { id: callId }, (res) => resolve(res)));
    expect(accept).toBe(false);

    const ch = bot.privateCallChannels.find(c => c.id === 'pcc-1');
    expect(ch.reserved).toBe(false);
  });

  test('reserved channels are released by TTL sweep', async () => {
    const bot = new DiscordBot('token', '!', 'GUILD_ID', createFakeDiscordClient());
    bot.privateCallChannels = [{ id: 'pcc-1', reserved: false, inUse: false }];

    // Reserve channel via API
    const channelId = bot.getAvailableCallChannel();
    expect(channelId).toBe('pcc-1');

    const ch = bot.privateCallChannels.find(c => c.id === 'pcc-1');
    expect(ch.reserved).toBe(true);
    expect(ch.inUse).toBe(false);

    // Make it stale
    const TTL = 50; // ms
    ch.reservedAt = Date.now() - (TTL + 10);

    // Sweep stale reservations
    const released = bot.releaseStaleReservedChannels(TTL);
    expect(released).toContain('pcc-1');

    expect(ch.reserved).toBe(false);
  });
});

import { jest } from '@jest/globals';
import EventEmitter from 'events';
import DiscordBot from '../src/bot.js';

// Silence console
console.info = jest.fn();
console.warn = jest.fn();
console.error = jest.fn();

describe('DiscordBot event handlers', () => {
  let mockClient;
  let bot;

  beforeEach(() => {
    mockClient = new EventEmitter();
    // Provide properties used by handlers
    mockClient.user = { tag: 'test-bot#1234' };

    bot = new DiscordBot('token', '!', 'guildId', mockClient);
  });

  test('onMessage replies to ping command', () => {
    bot.attachEventHandlers();

    const reply = jest.fn();
    const message = { content: '!ping', reply };

    mockClient.emit('messageCreate', message);

    expect(reply).toHaveBeenCalledWith('Pong!');

    bot.detachEventHandlers();
  });

  test('ready handler calls updateVoiceChannels', async () => {
    bot.attachEventHandlers();

    bot.updateVoiceChannels = jest.fn().mockResolvedValue();

    mockClient.emit('ready');

    // Allow async handler to run
    await new Promise(resolve => setImmediate(resolve));

    expect(bot.updateVoiceChannels).toHaveBeenCalled();

    bot.detachEventHandlers();
  });

  test('detachEventHandlers removes listeners', () => {
    const spyReady = jest.fn();
    bot.onClientReady = spyReady;

    bot.attachEventHandlers();
    bot.detachEventHandlers();

    mockClient.emit('ready');

    expect(spyReady).not.toHaveBeenCalled();
  });
});

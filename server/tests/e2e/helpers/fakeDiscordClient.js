// Minimal fake Discord client for tests
export function createFakeDiscordClient() {
  // Simple in-memory guild/member/channel model
  const members = new Map();
  const channels = new Map();

  return {
    guilds: {
      fetch: async (guildId) => ({
        id: guildId,
        members: {
          fetch: async (discordId) => {
            // return a member object with voice props
            const member = members.get(discordId) || {
              id: discordId,
              voice: {
                channel: { id: null },
                // setChannel mimics discord.js voice update
                setChannel: async function (channelId) {
                  this.channel = { id: channelId };
                  return this;
                }
              }
            };
            members.set(discordId, member);
            return member;
          }
        },
        channels: {
          fetch: async (id) => channels.get(id) || null
        },
        cache: {
          get: () => ({ channels })
        }
      }),
      cache: {
        get: (guildId) => ({
          channels: {
            fetch: async (id) => channels.get(id) || null
          },
          members: {
            fetch: async (discordId) => members.get(discordId) || null
          }
        })
      }
    },
    // helpers to pre-populate test data
    __helpers: {
      setMemberVoiceChannel(discordId, channelId) {
        const m = members.get(discordId) || { id: discordId, voice: { channel: { id: null }, setChannel: async function (c) { this.channel = { id: c }; return this; } } };
        m.voice.channel = { id: channelId };
        members.set(discordId, m);
      },
      addChannel(id, name) {
        channels.set(id, { id, name });
      }
    }
  };
}

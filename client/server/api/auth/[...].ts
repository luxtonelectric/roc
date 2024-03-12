import { NuxtAuthHandler } from '#auth'
import DiscordProvider from "next-auth/providers/discord";

const scopes = ['identify']

export default NuxtAuthHandler({
    secret: process.env.AUTH_SECRET,
    pages: {
      signIn: '/login'
    },
    providers: [
        // @ts-expect-error
        DiscordProvider.default({
          clientId: process.env.DISCORD_CLIENT_ID,
          clientSecret: process.env.DISCORD_CLIENT_SECRET,
          authorization: {params: {scope: scopes.join(' ')}},
        })
      ],
      callbacks: {
        async session({ session, token, user }) {
          // Send properties to the client, like an access_token and user id from a provider.
          //console.log(token);
          (session as any).sub = token.sub;
          
          return Promise.resolve(session);
        }
      }
})
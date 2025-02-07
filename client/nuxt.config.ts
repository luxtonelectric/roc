export default defineNuxtConfig({
  // Global CSS: https://go.nuxtjs.dev/config-css
  css: [
  ],

  // Plugins to run before rendering page: https://go.nuxtjs.dev/config-plugins
  plugins: [
  ],

  // Modules: https://go.nuxtjs.dev/config-modules
  modules: [
    '@nuxtjs/tailwindcss',
    '@sidebase/nuxt-auth'
    //'@nuxtjs/svg',
    //['@nuxtjs/fontawesome', {
    //  component: 'fa',
    //  suffix: true,
    //  icons: {
    //    solid: true
    //  }
    //}]
  ],

  runtimeConfig: {
    public: {
      socketServer: '',
      nextSession: 'No session scheduled'
    }
    //socketServer: 'http://roc.onourlines.co.uk:3001'
  },

  // Build Configuration: https://go.nuxtjs.dev/config-build
  build: {
    // extend(config, ctx) {
    //   config.module.rules.push({
    //     test: /\.(ogg|mp3|wav|mpe?g)$/i,
    //     loader: 'file-loader',
    //     options: {
    //       name: '[path][name].[ext]'
    //     }
    //   })
    // }
  },

  auth: {
    isEnabled: true,
    baseUrl: process.env.AUTH_ORIGIN,
    provider: {
        type: 'authjs'
    },
    globalAppMiddleware: true,
},

  devServer: {
    https: {
      key: 'localhost-key.pem',
      cert: 'localhost.pem'
    }
  },

  ssr:false,
  compatibilityDate: '2024-11-24',
})
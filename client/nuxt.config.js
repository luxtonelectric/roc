export default defineNuxtConfig({
  // Global page headers: https://go.nuxtjs.dev/config-head
  head: {
    title: 'simsig-controller',
    htmlAttrs: {
      lang: 'en'
    },
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'description', name: 'description', content: '' }
    ],
    link: [
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
    ]
  },

  // Global CSS: https://go.nuxtjs.dev/config-css
  css: [
  ],

  // Plugins to run before rendering page: https://go.nuxtjs.dev/config-plugins
  plugins: [
  ],

  // Auto import components: https://go.nuxtjs.dev/config-components
  components: true,

  // Modules: https://go.nuxtjs.dev/config-modules
  modules: [
    'nuxt-socket-io',
    '@nuxtjs/tailwindcss',
    //'@nuxtjs/svg',
    //['@nuxtjs/fontawesome', {
    //  component: 'fa',
    //  suffix: true,
    //  icons: {
    //    solid: true
    //  }
    //}]
  ],
  io: {
    sockets: [{
      name: 'main',
      url: 'http://roc.onourlines.co.uk:3001'
      //url: 'http://localhost:3001'
      // url: 'http://cronchyboi.redirectme.net:3001'
    }]
  },
  proxy: {
     // '/api/': 'http://localhost:3001/',
     // '/sockets': 'http://localhost:3001'
  },
  // Build Configuration: https://go.nuxtjs.dev/config-build
  build: {
    extend(config, ctx) {
      config.module.rules.push({
        test: /\.(ogg|mp3|wav|mpe?g)$/i,
        loader: 'file-loader',
        options: {
          name: '[path][name].[ext]'
        }
      })
    }
  },
  serverMiddleware: ['~/server-middleware/logger'],
  server:{
    host:'0.0.0.0',
    // port: 80
  }
})

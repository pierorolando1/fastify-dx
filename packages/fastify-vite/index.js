const { on, EventEmitter } = require('events')
const FastifyPlugin = require('fastify-plugin')
const processOptions = require('./options')

const build = require('./build')
const generate = require('./generate')

const production = require('./production')
const dev = require('./dev')
const setupRouting = require('./routing')
const { kScope, kHooks, kEmitter } = require('./symbols')

class Vite {
  constructor (scope, options) {
    this[kScope] = scope
    this[kEmitter] = new EventEmitter()
    this.options = processOptions(options, options.dev ? dev : production)
  }

  addHook (hook, handler) {
    if (hook in this[kHooks]) {
      this[kHooks][hook].push(handler)
    }
  }

  async ready () {
    if (this.options.dev) {
      await dev.setup.call(this, this.options)
    } else {
      await production.setup.call(this, this.options)
    }
    setupRouting.call(this, await on('ready', this[kEmitter]))
  }

  async commands (exit = true) {
    if (generate || build) {
      app.vite.options.update({ dev: false })
    }
    if (build) {
      await this.build()
      await this.exit()
    }
    if (generate) {
      await this.build()
    }
    await this.ready()
    if (generate) {
      this.scope.addHook('onReady', async () => {
        await this.generate()
        if (exit) {
          await this.exit()
        }
      })
    }
  }
  
  get (url, routeOptions) {
    return this.route(url, { method: 'GET', ...routeOptions })
  }

  post (url, { data, method, ...routeOptions } = {}) {
    return this.route(url, { data, method: 'GET', ...routeOptions })
  }

  build () {
    build.call(this)
  }

  generate () {
    generate.call(this)
  }
}

function fastifyVite (scope, options, done) {
  scope.decorate('vite', new Vite(options))
  done()
}

module.exports = FastifyPlugin(fastifyVite)

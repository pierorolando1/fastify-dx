const middie = require('middie')
const { writeFile, readFile, existsSync } = require('./utils')
const { createServer } = require('vite')
const { resolve } = require('path')
const { kEmitter } = require('./symbols')

async function ensureIndexHtml (options, indexHtmlPath) {
  if (!existsSync(indexHtmlPath)) {
    const baseIndexHtmlPath = resolve(options.renderer.path, 'base', 'index.html')
    await writeFile(indexHtmlPath, await readFile(baseIndexHtmlPath, 'utf8'))
  }
}

async function setup (options) {
  // Vite's pesky opinionated constraint of having index.html
  // as the main entry point for bundling — the file needs to exist
  const indexHtmlPath = resolve(options.root, 'index.html')
  await ensureIndexHtml(indexHtmlPath)

  // Middie seems to work well for running Vite's development server
  // Unsure if fastify-express is warranted here
  await this.scope.register(middie)

  // Create and enable Vite's Dev Server middleware
  const devServerOptions = {
    ...options.vite,
    server: {
      middlewareMode: 'ssr',
      ...options.vite.server,
    },
  }
  this.devServer = await createServer(devServerOptions)
  this.scope.use(this.devServer.middlewares)

  // In development mode, template is passed as an async function, which is
  // called on every request to ensure the newest index.html version is loaded
  options.getTemplate ??= async (url) => {
    const indexHtml = await readFile(indexHtmlPath, 'utf8')
    const transformedHtml = await this.devServer.transformIndexHtml(url, indexHtml)
    return await options.compileIndexHtml(transformedHtml)
  }

  const loadEntry = await options.getEntryLoader(options, this.devServer)
  const handler = options.getHandler(this.scope, options, loadEntry, getTemplate, this.devServer)

  this[kEmitter].emit('ready', { routes: entry.routes, handler })
}

// Loads the Vite application server entry.
// getEntry() must produce an object with a render function and
// optionally, a routes array. The official adapters will
// automatically load view files from the views/ folder and
// provide them in the routes array. The routes array is then used
// to register an individual Fastify route for each of the views.
async function getEntryLoader (options, devServer) {
  const modulePath = resolve(options.root, options.entry.server.replace(/^\/+/, ''))
  return async () => {
    const entryModule = await devServer.ssrLoadModule(modulePath)
    const entry = entryModule.default ?? entryModule
    return {
      routes: await entry.routes?.(),
      // In development mode, render is an async function so it
      // can always return the freshest version of the render
      // function exported by the Vite application server entry
      render: entry.render,
    }
  }
}

// Creates a route handler function set up for integration with
// the Vite Dev Server and hot reload of index.html
function getHandler (scope, options, loadEntry, getTemplate, viteDevServer) {
  return async function (req, reply) {
    try {
      const url = req.raw.url
      const { render } = await loadEntry()
      const template = await getTemplate(url)
      const fragments = await render(fastify, req, reply, url, options)
      reply.type('text/html')
      reply.send(template(req, fragments))
      return reply
    } catch (error) {
      viteDevServer.ssrFixStacktrace(error)
      // Propagate the error to the Fastify instance's error handler
      throw error
    }
  }
}

module.exports = {
  setup,
  getEntryLoader,
  getHandler,
}

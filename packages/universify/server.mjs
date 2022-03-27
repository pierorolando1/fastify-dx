
import Fastify from 'fastify'
import FastifySensible from 'fastify-sensible'
import FastifyApply from 'fastify-apply'
import FastifyPlugin from 'fastify-plugin'
import FastifyVite from 'fastify-vite'

import { devLogger } from './core.mjs'

export async function setup (context, command) {
  const {
    init,
    renderer,
    root,
    dev,
    server,
    applicable,
    plugable,
  } = context

  const app = Fastify({
    logger: {
      prettyPrint: dev ? devLogger : false,
    },
    ...server,
  })

  context.update({ app })

  await app.register(FastifySensible)
  await app.register(FastifyApply)

  await Promise.all(Object.entries(pluggable).map(([plugin, settings]) => {
    return app.register(plugin, settings)
  }))

  if (renderer) {
    await app.register(FastifyVite, { dev, root, renderer })
  }

  await app.apply(applicable)

  if (typeof init === 'function') {
    const initializer = FastifyPlugin(async function () {
      await init(app, context)
    })
    await app.register(initializer)
  }

  await app.vite.commands()

  return app
}

export async function listen (app, { dev, port, host }) {
  if (dev) {
    app.log.info('Development mode is enabled')
  }
  await app.listen(port, host)
}

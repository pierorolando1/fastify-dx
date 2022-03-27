const { resolve, writeFile, readFile, existsSync } = require('./utils')

const unescapedBacktick = /(?<!\\)`/g

async function ensureIndexHtml (options, indexHtmlPath) {
  if (!existsSync(indexHtmlPath)) {
    const baseIndexHtmlPath = resolve(options.renderer.path, 'base', 'index.html')
    await writeFile(indexHtmlPath, await readFile(baseIndexHtmlPath, 'utf8'))
  }
}

function compileIndexHtml (source) {
  const indexHtml = (
    '(function (req, fragments) {\n' +
    `  return \`${
      source
        // eslint-disable-next-line no-template-curly-in-string
        .replace('<html>', '<html${fragments.html ? fragments.html : \'\'}>')
        // eslint-disable-next-line no-template-curly-in-string
        .replace('<body>', '<body${fragments.body ? fragments.body : \'\'}>')
        .replace(unescapedBacktick, '\\`')
    }\`\n` +
    '})'
  )
  // eslint-disable-next-line no-eval
  return (0, eval)(indexHtml)
}

module.exports = { compileIndexHtml }

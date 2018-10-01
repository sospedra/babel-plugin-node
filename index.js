'use strict'

const fs = require('fs')
const path = require('path')

const aliases = {
  constants: 'constants-browserify',
  crypto: 'crypto-browserify',
  dns: 'node-libs-browser/mock/dns',
  domain: 'domain-browser',
  fs: 'node-libs-browser/mock/empty',
  http: 'stream-http',
  https: 'https-browserify',
  net: 'node-libs-browser/mock/net',
  os: 'os-browserify/browser',
  path: 'path-browserify',
  querystring: 'querystring-es3',
  stream: 'stream-browserify',
  _stream_duplex: 'readable-stream/duplex',
  _stream_passthrough: 'readable-stream/passthrough',
  _stream_readable: 'readable-stream/readable',
  _stream_transform: 'readable-stream/transform',
  _stream_writable: 'readable-stream/writable',
  sys: 'util',
  timers: 'timers-browserify',
  tls: 'node-libs-browser/mock/tls',
  tty: 'tty-browserify',
  vm: 'vm-browserify',
  zlib: 'browserify-zlib'
}

const rootPath = process.cwd()

const throwNewError = function (t, message) {
  return t.throwStatement(
    t.newExpression(t.identifier('Error'), [t.stringLiteral(message)])
  )
}

const pushGlobalAssign = function (t, nodePath, globalName) {
  nodePath.pushContainer('body', t.expressionStatement(
    t.assignmentExpression('=',
      t.memberExpression(
        t.identifier('global'),
        t.identifier(globalName)
      ),
      t.identifier(globalName)
    )
  ))
}

module.exports = function (babel) {
  return {
    visitor: {
      Program: function Program (path, state) {
        switch (state.file.opts.filename) {
          case rootPath + '/node_modules/buffer/index.js': {
            pushGlobalAssign(babel.types, path, 'Buffer')
            break
          }
          case rootPath + '/node_modules/process/browser.js': {
            pushGlobalAssign(babel.types, path, 'process')
            break
          }
        }
      },

      ImportDeclaration: function (nodePath, state) {
        const node = nodePath.node
        const arg = node.source

        if (!arg || arg.type !== 'StringLiteral') {
          return
        }

        const t = babel.types

        if (aliases && arg.value in aliases) {
          const replacement = aliases[arg.value]
          nodePath.replaceWith(
            t.importDeclaration(node.specifiers, t.stringLiteral(replacement))
          )
        }
      },

      CallExpression: function (nodePath, state) {
        const node = nodePath.node
        const callee = node.callee
        const arg = node.arguments[0]

        if (callee.type !== 'Identifier' || callee.name !== 'require' || !arg) {
          return
        }

        const t = babel.types
        const opts = state.opts

        // If the require() argument is not a string literal, replace the
        // require() call with an exception being thrown.
        if (arg.type !== 'StringLiteral') {
          if (opts.throwForNonStringLiteral) {
            const code = nodePath.hub.file.code.slice(arg.start, arg.end)
            nodePath.replaceWith(throwNewError(t, 'Invalid require: ' + code))
          }
          return
        }

        // If the require() argument is in the alias map, simply
        // rewrite the argument accordingly.
        if (aliases && arg.value in aliases) {
          const replacement = aliases[arg.value]
          nodePath.replaceWith(t.callExpression(callee, [t.stringLiteral(replacement)]))
          return
        }

        // If the require() argument is a module that's blacklisted as
        // never being resolvable, replace the require() call with an
        // exception being thrown. This mimics webpack's default behavior
        // for missing modules, but requires consumers to explicitly
        // blacklist every affected module rather than being the default.
        if (opts.throwForModules &&
            opts.throwForModules.length &&
            opts.throwForModules.indexOf(arg.value) !== -1
        ) {
          nodePath.replaceWith(throwNewError(t, 'Could not resolve: ' + arg.value))
          return
        }

        // If the require() argument points to a missing file whitelisted
        // for being optional, replace the require() call with an exception
        // being thrown. This is similar to `throwForModules`, but (a) for
        // relative imports and (b) will not throw if the referenced file is
        // in fact present.
        if (opts.throwForMissingFiles &&
            opts.throwForMissingFiles.length &&
            arg.value.startsWith('.') &&
            state.file.opts.filename
        ) {
          const absPath = path.resolve(
            path.dirname(state.file.opts.filename),
            arg.value
          )
          if (opts.throwForMissingFiles.indexOf(absPath) !== -1 && !fs.existsSync(absPath)) {
            nodePath.replaceWith(
              throwNewError(t, 'Could not resolve: ' + arg.value)
            )
          }
        }
      }
    }
  }
}

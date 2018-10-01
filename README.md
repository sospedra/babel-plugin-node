babel-plugin-node
=================

Make any environment `node` compatible.
It aliases all the `node` native API requires and adds `buffer` and `process` to the global scope.

### Install

Pick your flavour up:

`yarn add --dev babel-plugin-node`

`npm install --save-dev babel-plugin-node`

### Usage

In your `.babelrc`:

```
{
  "plugins": [
    "babel-plugin-node"
  ]
}
```

And in your app's entry point (`index.js`):

```
import 'babel-plugin-node/polyfill'
// or
require('babel-plugin-node/polyfill')
```

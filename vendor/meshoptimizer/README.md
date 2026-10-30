# Meshopt browser decoder

`meshopt_decoder.mjs` is copied unchanged from the official npm package
[`meshoptimizer@1.1.1`](https://www.npmjs.com/package/meshoptimizer/v/1.1.1).
The accompanying MIT license is in `LICENSE.md`.

The encoder and simplifier are development dependencies of `scripts/asset-tools`.
Only this decoder is shipped to the browser; its WebAssembly is embedded in the module.

<h1 align="center">
  <br>
  <a href="https://counterfactual.com"><img src="./logo.svg" alt="Counterfactual" width="150"></a>
  <br>
  Counterfactual Demo Apps & Bots
  <br>
  <br>
</h1>

<p align="center">
  <a href="https://circleci.com/gh/counterfactual/dapps-bots"><img src="https://circleci.com/gh/counterfactual/dapps-bots.svg?style=shield&circle-token=685122468572c2ac62de8f58f20560ce4d4ae5fc" alt="circleci"></a>
  <a href="https://lernajs.io/"><img src="https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg"/></a>
  <a href="https://counterfactual.com/chat"><img src="https://img.shields.io/discord/500370633901735947.svg"/></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="license"></a>
</p>

## What's this?

This repo contains some examples of the Counterfactual framework in action:

- The deprecated [Playground](./packages/playground) app, which we used in the past to run a [Node](https://github.com/counterfactual/monorepo/tree/master/packages/node) on the browser, much like the [Counterfactual Wallet](https://github.com/counterfactual/monorepo/tree/master/packages/wallet-ui) does nowadays with our [custom MetaMask fork](https://github.com/prototypal/metamask-extension).

- Two games built using [CF.js](https://github.com/counterfactual/monorepo/tree/master/packages/cf.js): [High Roller](./packages/dapp-high-roller) (built with [Stencil](https://stenciljs.com)) and [Tic-Tac-Toe](./packages/dapp-tic-tac-toe) (made with [React](https://reactjs.org)).

- Two bots so you can run the games on your own with no need for a real counterparty: [High Roller Bot](./packages/high-roller-bot) and [Tic-Tac-Toe Bot](./packages/tic-tac-toe-bot), both written in TypeScript.

## How do I run the dapps?

You'll need:

1. A build of [our MetaMask fork](https://github.com/counterfactual/monorepo/cf-metamask-extension) installed as a browser extension.
2. A Node process running the [Counterfactual Wallet](https://github.com/counterfactual/monorepo/tree/master/packages/wallet-ui).
3. A Node process running the [Counterfactual Hub](https://github.com/counterfactual/monorepo/tree/master/packages/simple-hub-server).

Check out the READMEs for each of these packages for more information on how to run them.

Once that's all set up and running, simply do:

```shell
yarn start
```

Keep in mind that this will open _several_ Node processes.

If you just want to run the dApps:

```shell
yarn start:dapps
```

If you just want to run the bots:

```shell
yarn start:bots
```

## Testing & linting

```shell
# Run all tests.
yarn test

# Fix linting issues.
yarn lint:fix
```

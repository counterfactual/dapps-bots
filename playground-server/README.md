# [Playground Server](https://github.com/counterfactual/monorepo/packages/playground-server) <img align="right" src="../../logo.svg" height="80px" />

The Playground Server provides several services for the Playground, including:

- _Account login and registration_
- _Matchmaking_, used to provide a multiplayer experience for the demo dApps.
- _Multisig creation_, to enable deposits on the onboarding flow

It also operates as an _intermediary Node_ between peers.

## Usage

For the server to operate successfully, it must have access to funds which it uses to deploy multisignature wallet contracts and collateralize channels. To fund the server, follow the [funding](#Funding-the-Hub-Account-for-Playground-Testing) instructions. Once the server's ETH account is funded, you can start the server by running:

```shell
yarn start
```

If running the entire Playground (and not just the server), from the root of the monorepo, execute:

```shell
yarn run:playground
```

You'll need a database (local or remote) to store account data there. By default, we recommend using [PostgreSQL](https://www.postgresql.org/), but since we connect to it via [Knex](http://knexjs.org), you can configure any database you want.

## Testing

You can run tests at any time using:

```shell
yarn test
```

Instead of using the regular PostgreSQL database, the test scope uses a volatile SQLite DB. Keep in mind that any schema changes you do on the real DB, you'll need to apply them to the SQLite schema creation as well.

## Environment settings

Unlike other packages, the Server relies on a [`.env-cmdrc`](./.env-cmdrc) which allows to configure multiple environments in the same file. See [env-cmd](https://www.npmjs.com/package/env-cmd#rc-file-usage)'s reference for more information on how it works.

## Funding the Hub Account for Playground Testing

### Where do I send Kovan ETH for testing?

First of all, you need to generate a mnemonic:

```node
$ node
> require("ethers").Wallet.createRandom().mnemonic
'camera enter drive paper elegant camp above attend board thought inch crash'
```

And save it in `.env`.

**Option 1** Compute the address:

```node
$ node
> const x = require("ethers").Wallet.createRandom().mnemonic;
> require("ethers").utils.HDNode.fromMnemonic(x).derivePath("m/44'/60'/0'/25446").address
'0x84D1C440f73DD5c20fA9a3a7CB8A24D5F70a753c'
```

**Option 2** Read the logs of `playground-server` when running it:

```
@counterfactual/playground-server: Node signer address: 0x84D1C440f73DD5c20fA9a3a7CB8A24D5F70a753c
```

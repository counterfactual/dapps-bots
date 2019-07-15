# Withdraw Protocol

## The `WithdrawParams` type

|       Field       |   type    |                    description                    |
| ----------------- | --------- | ------------------------------------------------- |
| `initiatorXpub`  | `xpub`    | xpub of `initiator`                              |
| `responderXpub`  | `xpub`    | xpub of `responder`                              |
| `multisigAddress` | `address` | address of the `initiator`-`responder` multisig |
| `recipient`       | `address` | address to withdraw ETH to                        |
| `amount`          | `uint256` | amount of ether to withdraw, in wei               |

## Commitments

### installRefundApp

This is exactly the same kind of install commitment produced by the install protocol for regular apps. This commitment installs a balance refund app.

### withdrawCommitment

This is a commitment for the multisig to send `amount` wei to `recipient`.

### uninstallRefundApp

This is exactly the same kind of uninstall commitment produced by the uninstall protocol for regular apps and uninstalls the app installed by `installRefundApp`.

## Signatures

| Signature |     Commitment     |  Signed By   |
| --------- | ------------------ | ------------ |
| s1        | installRefundApp   | `initiator` |
| s2        | installRefundApp   | `responder` |
| s3        | withdrawCommitment | `initiator` |
| s4        | withdrawCommitment | `responder` |
| s5        | uninstallRefundApp | `initiator` |
| s6        | uninstallRefundApp | `responder` |

## Messages

```eval_rst
.. mermaid:: ../diagrams/withdraw-exchange.mmd
```

|     Field     |   Description    |
| ------------- | ---------------- |
| `fromAddress` | `initiatorXpub` |
| `toAddress`   | `responderXpub` |
| `seq`         | `1`              |
| `signature`   | s1               |
| `signature2`  | s3               |

|     Field     |   Description    |
| ------------- | ---------------- |
| `fromAddress` | `responderXpub` |
| `toAddress`   | `initiatorXpub` |
| `seq`         | `2`              |
| `signature`   | s2               |
| `signature2`  | s4               |
| `signature3`  | s6               |

|     Field     |   Description    |
| ------------- | ---------------- |
| `fromAddress` | `initiatorXpub` |
| `toAddress`   | `responderXpub` |
| `seq`         | `-1`              |
| `signature`   | s5               |

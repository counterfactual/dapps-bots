import MinimumViableMultisig from "@counterfactual/contracts/build/MinimumViableMultisig.json";
import {
  Interface,
  joinSignature,
  keccak256,
  Signature,
  solidityPack
} from "ethers/utils";

import { sortSignaturesBySignerAddress } from "../utils";

import { EthereumCommitment, MultisigTransaction, Transaction } from "./types";

/// A commitment to make MinimumViableMultisig perform a message call
export abstract class MultisigCommitment extends EthereumCommitment {
  constructor(
    readonly multisigAddress: string,
    readonly multisigOwners: string[]
  ) {
    super();
  }

  abstract getTransactionDetails(): MultisigTransaction;

  public getSignedTransaction(sigs: Signature[]): Transaction {
    const multisigInput = this.getTransactionDetails();

    const signaturesList = sortSignaturesBySignerAddress(
      this.hashToSign(),
      sigs
    ).map(joinSignature);

    const txData = new Interface(
      MinimumViableMultisig.abi
    ).functions.execTransaction.encode([
      multisigInput.to,
      multisigInput.value,
      multisigInput.data,
      multisigInput.operation,
      signaturesList
    ]);

    // TODO: Deterministically compute `to` address
    return { to: this.multisigAddress, value: 0, data: txData };
  }

  public hashToSign(): string {
    const { to, value, data, operation } = this.getTransactionDetails();
    return keccak256(
      solidityPack(
        ["bytes1", "address[]", "address", "uint256", "bytes", "uint8"],
        ["0x19", this.multisigOwners, to, value, data, operation]
      )
    );
  }
}

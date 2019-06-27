import ConditionalTransactionDelegateTarget from "@counterfactual/contracts/build/ConditionalTransactionDelegateTarget.json";
import { AppIdentity, NetworkContext } from "@counterfactual/types";
import { Interface, keccak256, solidityPack } from "ethers/utils";
import * as log from "loglevel";

import { MultiSendCommitment } from "./multisend-commitment";
import { MultisigOperation, MultisigTransaction } from "./types";
import { appIdentityToHash } from "./utils/app-identity";

const iface = new Interface(ConditionalTransactionDelegateTarget.abi);

export class InstallCommitment extends MultiSendCommitment {
  constructor(
    public readonly networkContext: NetworkContext,
    public readonly multisig: string,
    public readonly multisigOwners: string[],
    public readonly appIdentity: AppIdentity,
    public readonly freeBalanceAppIdentity: AppIdentity,
    public readonly freeBalanceStateHash: string,
    public readonly freeBalanceversionNumber: number,
    public readonly freeBalanceTimeout: number,
    public readonly dependencyNonce: number,
    public readonly interpreterAddr: string,
    public readonly interpreterParams: string
  ) {
    super(
      networkContext,
      multisig,
      multisigOwners,
      freeBalanceAppIdentity,
      freeBalanceStateHash,
      freeBalanceversionNumber,
      freeBalanceTimeout
    );
  }

  public eachMultisigInput() {
    return [this.freeBalanceInput(), this.conditionalTransactionInput()];
  }

  private conditionalTransactionInput(): MultisigTransaction {
    const uninstallKey = keccak256(
      solidityPack(
        ["address", "bytes32"],
        [
          /* sender */ this.multisig,
          /* salt */ keccak256(
            solidityPack(["uint256"], [this.dependencyNonce])
          )
        ]
      )
    );

    log.debug(`
      install-commitment: computed
        uninstallKey = ${uninstallKey} using
        sender = ${this.multisig},
        timeout = 0,
        salt = ${keccak256(solidityPack(["uint256"], [this.dependencyNonce]))}
    `);

    const appIdentityHash = appIdentityToHash(this.appIdentity);

    return {
      to: this.networkContext.ConditionalTransactionDelegateTarget,
      value: 0,
      data: iface.functions.executeEffectOfInterpretedAppOutcome.encode([
        /* appRegistry */ this.networkContext.ChallengeRegistry,
        /* uninstallKeyRegistry */ this.networkContext.UninstallKeyRegistry,
        /* uninstallKey */ uninstallKey,
        /* appIdentityHash* */ appIdentityHash,
        /* interpreterAddress */ this.interpreterAddr,
        /* interpreterParams */ this.interpreterParams
      ]),
      operation: MultisigOperation.DelegateCall
    };
  }
}

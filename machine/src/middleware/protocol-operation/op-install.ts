import * as cf from "@counterfactual/cf.js";
import ConditionalTransactionJson from "@counterfactual/contracts/build/contracts/ConditionalTransaction.json";
import * as ethers from "ethers";

import { MultiSendOp } from "./multi-send-op";
import { MultisigInput, Operation } from "./types";

const { keccak256 } = ethers.utils;
const { abi } = cf.utils;

export class OpInstall extends MultiSendOp {
  constructor(
    readonly networkContext: cf.utils.NetworkContext,
    readonly multisig: cf.utils.Address,
    readonly app: cf.app.AppInstance,
    readonly freeBalance: cf.utils.FreeBalance,
    readonly dependencyNonce: cf.utils.Nonce
  ) {
    super(networkContext, multisig, freeBalance, dependencyNonce);
  }

  /**
   * @override common.MultiSendOp
   */
  public eachMultisigInput(): MultisigInput[] {
    return [this.freeBalanceInput(), this.conditionalTransactionInput()];
  }

  private conditionalTransactionInput(): MultisigInput {
    const to = this.networkContext.conditionalTransactionAddr;
    const val = 0;
    const terms = [
      this.app.terms.assetType,
      this.app.terms.limit,
      this.app.terms.token
    ];
    const uninstallKey = keccak256(
      abi.encodePacked(
        ["address", "uint256", "uint256"],
        [this.multisig, 0, this.dependencyNonce.salt]
      )
    );
    const data = new ethers.utils.Interface(
      ConditionalTransactionJson.abi
    ).functions.executeAppConditionalTransaction.encode([
      this.networkContext.registryAddr,
      this.networkContext.nonceRegistryAddr,
      uninstallKey,
      this.appCfAddress,
      terms
    ]);
    const op = Operation.Delegatecall;
    return new MultisigInput(to, val, data, op);
  }

  get appCfAddress(): cf.utils.H256 {
    return this.app.cfAddress();
  }
}

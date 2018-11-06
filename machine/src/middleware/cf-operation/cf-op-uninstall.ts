import * as cf from "@counterfactual/cf.js";

import { CfMultiSendOp } from "./cf-multisend-op";
import { MultisigInput } from "./types";

export class CfOpUninstall extends CfMultiSendOp {
  constructor(
    readonly networkContext: cf.utils.NetworkContext,
    readonly multisig: cf.utils.Address,
    readonly cfFreeBalance: cf.utils.CfFreeBalance,
    readonly dependencyNonce: cf.utils.CfNonce
  ) {
    super(networkContext, multisig, cfFreeBalance, dependencyNonce);
  }

  /**
   * @override common.CfMultiSendOp
   */
  public eachMultisigInput(): MultisigInput[] {
    return [this.freeBalanceInput(), this.dependencyNonceInput()];
  }
}

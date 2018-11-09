import * as cf from "@counterfactual/cf.js";
import AppInstanceJson from "@counterfactual/contracts/build/contracts/AppInstance.json";
import RegistryJson from "@counterfactual/contracts/build/contracts/Registry.json";
import * as ethers from "ethers";

/**
 * Returns the calldata for a call to `registry` that looks up `appCfAddr` and
 * calls the resulting address's `setState` function with the provided `appStateHash`,
 * `appLocalNonce`, `timeout` and `signatures`
 */
export function proxyCallSetStateData(
  networkContext: cf.utils.NetworkContext,
  appStateHash: cf.utils.H256,
  appCfAddr: cf.utils.H256,
  appLocalNonce: number,
  timeout: number,
  signatures: cf.utils.Bytes
): cf.utils.Bytes {
  return new ethers.utils.Interface(
    RegistryJson.abi
  ).functions.proxyCall.encode([
    networkContext.registryAddr,
    appCfAddr,
    new ethers.utils.Interface(AppInstanceJson.abi).functions.setState.encode([
      appStateHash,
      appLocalNonce,
      timeout,
      signatures
    ])
  ]);
}

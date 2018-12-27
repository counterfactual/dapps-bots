import BuildArtifact from "@counterfactual/contracts/build/contracts/ETHBalanceRefundApp.json";
import { AddressZero, Zero } from "ethers/constants";

import { Terms } from "./app";
import { AppInstance } from "./app-instance";
import { AppDefinition } from "./types";

export class ETHBalanceRefundApp extends AppInstance {
  constructor(appAddress: string, signingKeys: string[]) {
    const timeout = 100;
    const terms = new Terms(0, Zero, AddressZero);
    const abiEncodings = AppInstance.generateAbiEncodings(BuildArtifact.abi);

    const appDefinition: AppDefinition = {
      address: appAddress,
      appStateEncoding: abiEncodings.appStateEncoding,
      appActionEncoding: abiEncodings.appActionEncoding
    };

    super(signingKeys, appDefinition, terms, timeout);
  }
}

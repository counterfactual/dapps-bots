import { BigNumber } from "ethers/utils";

export enum AssetType {
  ETH = 0,
  ERC20 = 1
}

export interface Terms {
  assetType: AssetType;
  limit: BigNumber;
  token: string;
}

export interface AppIdentity {
  owner: string;
  signingKeys: string[];
  appInterfaceHash: string;
  termsHash: string;
  defaultTimeout: number;
}

export interface AppInterface {
  addr: string;
  applyAction: string;
  resolve: string;
  getTurnTaker: string;
  isStateTerminal: string;
  stateEncoding: string;
  actionEncoding: string | undefined;
}

export interface AppInstance {
  owner: string;
  signingKeys: string[];
  appInterface: AppInterface;
  terms: Terms;
  defaultTimeout: number;
}

export interface SignedStateHashUpdate {
  stateHash: string;
  nonce: number;
  timeout: number;
  signatures: string;
}

export interface ETHBucketAppState {
  alice: string;
  bob: string;
  aliceBalance: BigNumber;
  bobBalance: BigNumber;
}

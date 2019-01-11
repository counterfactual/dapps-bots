// TODO: Probably merge this file with ./types.ts

import { AppInterface, Terms } from "@counterfactual/types";
import { BigNumber, BigNumberish, Signature } from "ethers/utils";

import { Protocol } from "./types";

// The application-specific state of an app instance, to be interpreted by the
// app developer. We just treat it as an opaque blob; however since we pass this
// around in protocol messages and include this in transaction data in disputes,
// we impose some restrictions on the type; they must be serializable both as
// JSON and as solidity structs.
export type AppState = {
  [x: string]: string | BigNumberish | boolean | AppState | AppStateArray;
};

// Ideally this should be a `type` not an `interface` but self-referencial
// types is not supported: github.com/Microsoft/TypeScript/issues/6230
export interface AppStateArray
  extends Array<string | number | boolean | AppState | AppStateArray> {}

export type ProtocolMessage = {
  protocol: Protocol;
  params: ProtocolParameters;
  fromAddress: string;
  toAddress: string;
  seq: number;
  signature?: Signature;
  signature2?: Signature;
  signature3?: Signature;
};

export type SetupParams = {
  initiatingAddress: string;
  respondingAddress: string;
  multisigAddress: string;
};

export type UpdateParams = {
  initiatingAddress: string;
  respondingAddress: string;
  multisigAddress: string;
  appIdentityHash: string;
  newState: AppState;
};

export type InstallParams = {
  initiatingAddress: string;
  respondingAddress: string;
  multisigAddress: string;
  aliceBalanceDecrement: BigNumber;
  bobBalanceDecrement: BigNumber;
  signingKeys: string[];
  initialState: AppState;
  terms: Terms;
  appInterface: AppInterface;
  defaultTimeout: number;
};

export type UninstallParams = {
  appIdentityHash: string;
  initiatingAddress: string;
  respondingAddress: string;
  multisigAddress: string;
  aliceBalanceIncrement: BigNumber;
  bobBalanceIncrement: BigNumber;
};

export type InstallVirtualAppParams = {
  initiatingAddress: string;
  respondingAddress: string;
  multisig1Address: string;
  multisig2Address: string;
  intermediaryAddress: string;
  signingKeys: string[];
  defaultTimeout: number;
  appInterface: AppInterface;
  initialState: AppState;
  aliceBalanceDecrement: BigNumber;
  bobBalanceDecrement: BigNumber;
  terms: Terms;
};

type ProtocolParameters =
  | SetupParams
  | UpdateParams
  | InstallParams
  | UninstallParams
  | InstallVirtualAppParams;

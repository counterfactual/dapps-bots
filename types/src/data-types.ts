// https://github.com/counterfactual/monorepo/blob/master/packages/cf.js/API_REFERENCE.md#data-types
import { BigNumber } from "ethers/utils";

import { AppInterface, SolidityABIEncoderV2Type } from ".";
import { ABIEncoding } from "./simple-types";

export type TwoPartyFixedOutcomeInterpreterParams = {
  // Derived from:
  // packages/contracts/contracts/interpreters/TwoPartyFixedOutcomeETHInterpreter.sol#L10
  playerAddrs: [string, string];
  amount: BigNumber;
};

export type CoinTransferInterpreterParams = {
  // Derived from:
  // packages/contracts/contracts/interpreters/CoinTransferETHInterpreter.sol#L18
  limit: BigNumber;
  tokenAddress: string;
};

export type AppInstanceJson = {
  identityHash: string;
  multisigAddress: string;
  signingKeys: string[];
  defaultTimeout: number;
  appInterface: AppInterface;
  isVirtualApp: boolean;
  appSeqNo: number;
  latestState: SolidityABIEncoderV2Type;
  latestVersionNumber: number;
  latestTimeout: number;

  /**
   * Interpreter-related Fields
   */
  twoPartyOutcomeInterpreterParams?: {
    // Derived from:
    // packages/contracts/contracts/interpreters/TwoPartyFixedOutcomeETHInterpreter.sol#L10
    playerAddrs: [string, string];
    amount: { _hex: string };
  };

  coinTransferInterpreterParams?: {
    // Derived from:
    // packages/contracts/contracts/interpreters/CoinTransferETHInterpreter.sol#L18
    limit: { _hex: string };
    tokenAddress: string;
  };

  tokenAddress: string;
};

export type AppInstanceInfo = {
  identityHash: string;
  appDefinition: string;
  abiEncodings: AppABIEncodings;
  myDeposit: BigNumber;
  peerDeposit: BigNumber;
  timeout: BigNumber;
  proposedByIdentifier: string; // xpub
  proposedToIdentifier: string; // xpub
  intermediaries?: string[];

  /**
   * Interpreter-related Fields
   */
  twoPartyOutcomeInterpreterParams?: TwoPartyFixedOutcomeInterpreterParams;
  coinTransferInterpreterParams?: CoinTransferInterpreterParams;
};

export type AppInstanceProposal = {
  identityHash: string;
  appDefinition: string;
  abiEncodings: AppABIEncodings;
  myDeposit: BigNumber;
  peerDeposit: BigNumber;
  timeout: BigNumber;
  proposedByIdentifier: string; // xpub
  proposedToIdentifier: string; // xpub
  intermediaries?: string[];

  /**
   * Interpreter-related Fields
   */
  twoPartyOutcomeInterpreterParams?: TwoPartyFixedOutcomeInterpreterParams;
  coinTransferInterpreterParams?: CoinTransferInterpreterParams;
};

export type AppABIEncodings = {
  stateEncoding: ABIEncoding;
  actionEncoding: ABIEncoding | undefined;
};

// Interpreter.sol::OutcomeType
export enum OutcomeType {
  TWO_PARTY_FIXED_OUTCOME = 0,
  TWO_PARTY_DYNAMIC_OUTCOME = 1,
  COIN_TRANSFER = 2
}

// TwoPartyFixedOutcome.sol::Outcome
export enum TwoPartyFixedOutcome {
  SEND_TO_ADDR_ONE = 0,
  SEND_TO_ADDR_TWO = 1,
  SPLIT_AND_SEND_TO_BOTH_ADDRS = 2
}

export const coinBalanceRefundStateEncoding = `
  tuple(
    address recipient,
    address multisig,
    uint256 threshold,
    address token
  )
`;

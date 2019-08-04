import { OutcomeType } from "@counterfactual/types";
import { Zero } from "ethers/constants";
import { BigNumber, bigNumberify } from "ethers/utils";
import { fromExtendedKey } from "ethers/utils/hdnode";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../constants";
import { getFreeBalanceAppInterface } from "../ethereum/utils/free-balance-app";
import { xkeysToSortedKthAddresses } from "../machine/xkeys";

import { AppInstance } from "./app-instance";

const HARD_CODED_ASSUMPTIONS = {
  freeBalanceInitialStateTimeout: 172800,
  // We assume the Free Balance is the first app ever installed
  appSequenceNumberForFreeBalance: 0
};

/*
Keep in sync with the solidity struct LibOutcome::CoinTransfer
*/
export type CoinTransfer = {
  to: string;
  amount: BigNumber;
};

/*
Equivalent to the above type but with serialized BigNumbers
*/
export type CoinTransferJSON = {
  to: string;
  amount: {
    _hex: string;
  };
};

/*
CoinTransferMap is isomorphic to the solidity type `CoinTransfer[]`, with the
restriction that values of the solidity type be arrays such that no two
elements are CoinTransfers with the same `to` field. We prefer CoinTransferMap
in client-side code for easier access, but we cannot use it in solidity due to
nonexistent support for non-storage mappings.
*/
export type CoinTransferMap = {
  [to: string]: BigNumber;
};

/*
A doubly-nested map of BigNumbers indexed first (outermost) by the tokenAddress
and secondly (innermost) by the beneficiary address
*/
export type TokenIndexedCoinTransferMap = {
  [tokenAddress: string]: CoinTransferMap;
};

export type ActiveAppsMap = { [appInstanceIdentityHash: string]: true };

export type FreeBalanceState = {
  activeAppsMap: ActiveAppsMap;
  balancesIndexedByToken: { [tokenAddress: string]: CoinTransfer[] };
};

export type FreeBalanceStateJSON = {
  tokenAddresses: string[];
  balances: CoinTransferJSON[][];
  activeApps: string[];
};

/**
 * Note that the state of the Free Balance is held as plain types
 * and only converted to more complex types (i.e. BigNumber) upon usage.
 */
export function createFreeBalance(
  userNeuteredExtendedKeys: string[],
  coinBucketAddress: string,
  freeBalanceTimeout: number
) {
  const sortedTopLevelKeys = xkeysToSortedKthAddresses(
    userNeuteredExtendedKeys,
    0 // NOTE: We re-use 0 which is also used as the keys for `multisigOwners`
  );

  const initialState: FreeBalanceState = {
    activeAppsMap: {},
    balancesIndexedByToken: {
      // NOTE: Extremely important to understand that the default
      // addresses of the recipients are the "top level keys" as defined
      // as the 0th derived children of the xpubs.
      [CONVENTION_FOR_ETH_TOKEN_ADDRESS]: [
        { to: sortedTopLevelKeys[0], amount: Zero },
        { to: sortedTopLevelKeys[1], amount: Zero }
      ]
    }
  };

  return new AppInstance(
    sortedTopLevelKeys,
    freeBalanceTimeout,
    getFreeBalanceAppInterface(coinBucketAddress),
    false,
    HARD_CODED_ASSUMPTIONS.appSequenceNumberForFreeBalance,
    serializeFreeBalanceState(initialState),
    0,
    HARD_CODED_ASSUMPTIONS.freeBalanceInitialStateTimeout,
    OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER
  );
}

/**
 * Given an AppInstance whose state is FreeBalanceState, convert the state
 * into the locally more convenient data type CoinTransferMap and return that.
 *
 * Note that this function will also default the `to` addresses of a new token
 * to the 0th derived public addresses of the StateChannel, the same as all
 * FreeBalanceApp AppInstances.
 *
 * @export
 * @param {AppInstance} freeBalance - an AppInstance that is a FreeBalanceApp
 *
 * @returns {CoinTransferMap} - HexFreeBalanceState indexed on tokenAddresses
 */
export function getBalancesFromFreeBalanceAppInstance(
  freeBalanceAppInstance: AppInstance,
  tokenAddress: string
): CoinTransferMap {
  const freeBalanceState = deserializeFreeBalanceState(
    freeBalanceAppInstance.state as FreeBalanceStateJSON
  );

  const coinTransfers = freeBalanceState.balancesIndexedByToken[
    tokenAddress
  ] || [
    { to: freeBalanceAppInstance.participants[0], amount: Zero },
    { to: freeBalanceAppInstance.participants[1], amount: Zero }
  ];

  return convertCoinTransfersToCoinTransfersMap(coinTransfers);
}

export function deserializeFreeBalanceState(
  freeBalanceStateJSON: FreeBalanceStateJSON
): FreeBalanceState {
  const { activeApps, tokenAddresses, balances } = freeBalanceStateJSON;
  return {
    balancesIndexedByToken: (tokenAddresses || []).reduce(
      (acc, tokenAddress, idx) => ({
        ...acc,
        [tokenAddress]: balances[idx].map(({ to, amount }) => ({
          to,
          amount: bigNumberify(amount._hex)
        }))
      }),
      {}
    ),
    activeAppsMap: (activeApps || []).reduce(
      (acc, identityHash) => ({ ...acc, [identityHash]: true }),
      {}
    )
  };
}

export function serializeFreeBalanceState(
  freeBalanceState: FreeBalanceState
): FreeBalanceStateJSON {
  return {
    activeApps: Object.keys(freeBalanceState.activeAppsMap),
    tokenAddresses: Object.keys(freeBalanceState.balancesIndexedByToken),
    balances: Object.values(freeBalanceState.balancesIndexedByToken).map(
      balances =>
        balances.map(({ to, amount }) => ({
          to,
          amount: {
            _hex: amount.toHexString()
          }
        }))
    )
  };
}

// The following conversion functions are only relevant in the context
// of reading/writing to a channel's Free Balance
export function convertCoinTransfersToCoinTransfersMap(
  coinTransfers: CoinTransfer[]
): CoinTransferMap {
  return (coinTransfers || []).reduce(
    (acc, { to, amount }) => ({ ...acc, [to]: amount }),
    {}
  );
}

export function convertCoinTransfersMapToCoinTransfers(
  coinTransfersMap: CoinTransferMap
): CoinTransfer[] {
  return Object.entries(coinTransfersMap).map(([to, amount]) => ({
    to,
    amount
  }));
}

/**
 * Address used for a Node's free balance
 */
export function getFreeBalanceAddress(publicIdentifier: string) {
  return fromExtendedKey(publicIdentifier).derivePath("0").address;
}

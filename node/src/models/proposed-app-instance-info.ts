import {
  AppABIEncodings,
  AppInterface,
  CoinTransferInterpreterParams,
  OutcomeType,
  SolidityABIEncoderV2Type
} from "@counterfactual/types";
import { AddressZero } from "ethers/constants";
import { BigNumber, bigNumberify, BigNumberish } from "ethers/utils";

import { xkeyKthAddress, xkeysToSortedKthAddresses } from "../machine";
import { AppInstance, StateChannel } from "../models";

export interface IAppInstanceProposal {
  appDefinition: string;
  abiEncodings: AppABIEncodings;
  initiatorDeposit: BigNumberish;
  initiatorDepositTokenAddress: string;
  responderDeposit: BigNumberish;
  responderDepositTokenAddress: string;
  timeout: BigNumberish;
  initialState: SolidityABIEncoderV2Type;
  proposedByIdentifier: string;
  proposedToIdentifier: string;
  intermediaries?: string[];
  outcomeType: OutcomeType;
}

export interface AppInstanceProposalJSON {
  identityHash: string;
  appDefinition: string;
  abiEncodings: AppABIEncodings;
  initiatorDeposit: { _hex: string };
  initiatorDepositTokenAddress: string;
  responderDeposit: { _hex: string };
  responderDepositTokenAddress: string;
  timeout: { _hex: string };
  initialState: SolidityABIEncoderV2Type;
  proposedByIdentifier: string;
  proposedToIdentifier: string;
  intermediaries?: string[];
  outcomeType: OutcomeType;
}

/**
 * The @counterfactual/cf.js package has a concept of an `AppInstanceInfo`:
 * https://github.com/counterfactual/monorepo/blob/master/packages/cf.js/API_REFERENCE.md#data-type-appinstanceinfo.
 * This is a simplified, client-side representation of what the machine calls an `AppInstance`.
 *
 * When an `AppInstanceInfo` is proposed to be installed by a client running the `cf.js`
 * package, the Node receives some state indicating the parameters of the proposal.
 * This class captures said state for the duration of the proposal being made and
 * the respecting `AppInstance` is installed.
 */
export class AppInstanceProposal {
  identityHash: string;
  appDefinition: string;
  abiEncodings: AppABIEncodings;
  initiatorDeposit: BigNumber;
  initiatorDepositTokenAddress: string;
  responderDeposit: BigNumber;
  responderDepositTokenAddress: string;
  timeout: BigNumber;
  initialState: SolidityABIEncoderV2Type;
  proposedByIdentifier: string;
  proposedToIdentifier: string;
  intermediaries?: string[];
  outcomeType: OutcomeType;

  constructor(
    proposeParams: IAppInstanceProposal,
    channel?: StateChannel,
    overrideId?: string
  ) {
    this.appDefinition = proposeParams.appDefinition;
    this.abiEncodings = proposeParams.abiEncodings;
    this.initiatorDeposit = bigNumberify(proposeParams.initiatorDeposit);
    this.initiatorDepositTokenAddress =
      proposeParams.initiatorDepositTokenAddress;
    this.responderDeposit = bigNumberify(proposeParams.responderDeposit);
    this.responderDepositTokenAddress =
      proposeParams.responderDepositTokenAddress;
    this.timeout = bigNumberify(proposeParams.timeout);
    this.proposedByIdentifier = proposeParams.proposedByIdentifier;
    this.proposedToIdentifier = proposeParams.proposedToIdentifier;
    this.initialState = proposeParams.initialState;
    this.intermediaries = proposeParams.intermediaries;
    this.outcomeType = proposeParams.outcomeType;
    this.identityHash = overrideId || this.getIdentityHashFor(channel!);
  }

  // TODO: Note the construction of this is duplicated from the machine
  getIdentityHashFor(stateChannel: StateChannel) {
    const proposedAppInterface: AppInterface = {
      addr: this.appDefinition,
      ...this.abiEncodings
    };

    let signingKeys: string[];
    let isVirtualApp: boolean;

    if ((this.intermediaries || []).length > 0) {
      isVirtualApp = true;

      const appSeqNo = stateChannel.numInstalledApps;

      const [intermediaryXpub] = this.intermediaries!;

      // https://github.com/counterfactual/specs/blob/master/09-install-virtual-app-protocol.md#derived-fields
      signingKeys = [xkeyKthAddress(intermediaryXpub, appSeqNo)].concat(
        xkeysToSortedKthAddresses(
          [this.proposedByIdentifier, this.proposedToIdentifier],
          appSeqNo
        )
      );
    } else {
      isVirtualApp = false;
      signingKeys = stateChannel.getNextSigningKeys();
    }

    const owner = isVirtualApp ? AddressZero : stateChannel.multisigAddress;

    const interpreterParams: CoinTransferInterpreterParams = {
      limit: [],
      tokens: []
    };

    const proposedAppInstance = new AppInstance(
      owner,
      signingKeys,
      bigNumberify(this.timeout).toNumber(),
      proposedAppInterface,
      isVirtualApp,
      isVirtualApp ? 1337 : stateChannel.numInstalledApps,
      this.initialState,
      0,
      bigNumberify(this.timeout).toNumber(),
      // the below two arguments are not currently used in app identity
      // computation
      undefined,
      // this is not relevant here as it gets set properly later in the context
      // of the channel during an install, and it's not used to calculate
      // the AppInstance ID so there won't be a possible mismatch between
      // a proposed AppInstance ID and an installed AppInstance ID
      interpreterParams
    );

    return proposedAppInstance.identityHash;
  }

  toJson(): AppInstanceProposalJSON {
    return {
      identityHash: this.identityHash,
      appDefinition: this.appDefinition,
      abiEncodings: this.abiEncodings,
      initiatorDeposit: { _hex: this.initiatorDeposit.toHexString() },
      initiatorDepositTokenAddress: this.initiatorDepositTokenAddress,
      responderDeposit: { _hex: this.responderDeposit.toHexString() },
      responderDepositTokenAddress: this.responderDepositTokenAddress,
      initialState: this.initialState,
      timeout: { _hex: this.timeout.toHexString() },
      proposedByIdentifier: this.proposedByIdentifier,
      proposedToIdentifier: this.proposedToIdentifier,
      intermediaries: this.intermediaries,
      outcomeType: this.outcomeType
    };
  }

  static fromJson(json: AppInstanceProposalJSON): AppInstanceProposal {
    const proposeParams: IAppInstanceProposal = {
      appDefinition: json.appDefinition,
      abiEncodings: json.abiEncodings,
      initiatorDeposit: bigNumberify(json.initiatorDeposit._hex),
      initiatorDepositTokenAddress: json.initiatorDepositTokenAddress,
      responderDeposit: bigNumberify(json.responderDeposit._hex),
      responderDepositTokenAddress: json.responderDepositTokenAddress,
      timeout: bigNumberify(json.timeout._hex),
      initialState: json.initialState,
      proposedByIdentifier: json.proposedByIdentifier,
      proposedToIdentifier: json.proposedToIdentifier,
      intermediaries: json.intermediaries,
      outcomeType: json.outcomeType
    };

    return new AppInstanceProposal(proposeParams, undefined, json.identityHash);
  }
}

import {
  Address,
  AppABIEncodings,
  AppInstanceInfo,
  AppInterface,
  Bytes32,
  SolidityABIEncoderV2Type
} from "@counterfactual/types";
import { AddressZero } from "ethers/constants";
import { BigNumber, bigNumberify } from "ethers/utils";

import { xkeyKthAddress, xkeysToSortedKthAddresses } from "../machine";
import { AppInstance, StateChannel } from "../models";

export interface IProposedAppInstanceInfo {
  appDefinition: Address;
  abiEncodings: AppABIEncodings;
  myDeposit: BigNumber;
  peerDeposit: BigNumber;
  timeout: BigNumber;
  initialState: SolidityABIEncoderV2Type;
  proposedByIdentifier: string;
  proposedToIdentifier: string;
  intermediaries?: string[];
}

export interface ProposedAppInstanceInfoJSON {
  id: Bytes32;
  appDefinition: Address;
  abiEncodings: AppABIEncodings;
  myDeposit: string;
  peerDeposit: string;
  timeout: string;
  initialState: SolidityABIEncoderV2Type;
  proposedByIdentifier: string;
  proposedToIdentifier: string;
  intermediaries?: string[];
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
export class ProposedAppInstanceInfo implements AppInstanceInfo {
  id: Bytes32;
  appDefinition: Address;
  abiEncodings: AppABIEncodings;
  myDeposit: BigNumber;
  peerDeposit: BigNumber;
  timeout: BigNumber;
  initialState: SolidityABIEncoderV2Type;
  proposedByIdentifier: string;
  proposedToIdentifier: string;
  intermediaries?: string[];

  constructor(
    proposeParams: IProposedAppInstanceInfo,
    channel?: StateChannel,
    overrideId?: Bytes32
  ) {
    this.appDefinition = proposeParams.appDefinition;
    this.abiEncodings = proposeParams.abiEncodings;
    this.myDeposit = proposeParams.myDeposit;
    this.peerDeposit = proposeParams.peerDeposit;
    this.timeout = proposeParams.timeout;
    this.proposedByIdentifier = proposeParams.proposedByIdentifier;
    this.proposedToIdentifier = proposeParams.proposedToIdentifier;
    this.initialState = proposeParams.initialState;
    this.intermediaries = proposeParams.intermediaries;
    this.id = overrideId || this.getIdentityHashFor(channel!);
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

    const proposedAppInstance = new AppInstance(
      owner,
      signingKeys,
      bigNumberify(this.timeout).toNumber(),
      proposedAppInterface,
      isVirtualApp,
      isVirtualApp ? 1337 : stateChannel.numInstalledApps,
      stateChannel.rootNonceValue,
      this.initialState,
      0,
      bigNumberify(this.timeout).toNumber(),
      // the below two arguments are not currently used in app identity
      // computation
      undefined,
      {
        limit: bigNumberify(this.myDeposit).add(this.peerDeposit)
      }
    );

    return proposedAppInstance.identityHash;
  }

  toJson() {
    return {
      id: this.id,
      appDefinition: this.appDefinition,
      abiEncodings: this.abiEncodings,
      myDeposit: this.myDeposit,
      peerDeposit: this.peerDeposit,
      initialState: this.initialState,
      timeout: this.timeout,
      proposedByIdentifier: this.proposedByIdentifier,
      proposedToIdentifier: this.proposedToIdentifier,
      intermediaries: this.intermediaries
    };
  }

  static fromJson(json: ProposedAppInstanceInfoJSON): ProposedAppInstanceInfo {
    const proposeParams: IProposedAppInstanceInfo = {
      appDefinition: json.appDefinition,
      abiEncodings: json.abiEncodings,
      myDeposit: bigNumberify(json.myDeposit),
      peerDeposit: bigNumberify(json.peerDeposit),
      timeout: bigNumberify(json.timeout),
      initialState: json.initialState,
      proposedByIdentifier: json.proposedByIdentifier,
      proposedToIdentifier: json.proposedToIdentifier,
      intermediaries: json.intermediaries
    };
    return new ProposedAppInstanceInfo(proposeParams, undefined, json.id);
  }
}

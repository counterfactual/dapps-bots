import {
  AppInstance,
  StateChannel,
  xkeysToSortedKthAddresses
} from "@counterfactual/machine";
import {
  Address,
  AppABIEncodings,
  AppInstanceInfo,
  AppInterface,
  BlockchainAsset,
  Bytes32,
  SolidityABIEncoderV2Struct,
  Terms
} from "@counterfactual/types";
import { AddressZero, Zero } from "ethers/constants";
import { BigNumber, bigNumberify } from "ethers/utils";

export interface IProposedAppInstanceInfo {
  appId: Address;
  abiEncodings: AppABIEncodings;
  asset: BlockchainAsset;
  myDeposit: BigNumber;
  peerDeposit: BigNumber;
  timeout: BigNumber;
  initialState: SolidityABIEncoderV2Struct;
  proposedByIdentifier: string;
  proposedToIdentifier: string;
  intermediaries?: string[];
}

export interface ProposedAppInstanceInfoJSON {
  id: Bytes32;
  appId: Address;
  abiEncodings: AppABIEncodings;
  asset: BlockchainAsset;
  myDeposit: string;
  peerDeposit: string;
  timeout: string;
  initialState: SolidityABIEncoderV2Struct;
  proposedByIdentifier: string;
  proposedToIdentifier: string;
  intermediaries?: string[];
}

/**
 * The @counterfactual/cf.js package has a concept of an `AppInstanceInfo`:
 * https://github.com/counterfactual/monorepo/blob/master/packages/cf.js/API_REFERENCE.md#data-type-appinstanceinfo.
 * This is a simplified, client-side representation of what the @counterfactual/machine package calls an `AppInstance`.
 *
 * When an `AppInstanceInfo` is proposed to be installed by a client running the `cf.js`
 * package, the Node receives some state indicating the parameters of the proposal.
 * This class captures said state for the duration of the proposal being made and
 * the respecting `AppInstance` is installed.
 */
export class ProposedAppInstanceInfo implements AppInstanceInfo {
  id: Bytes32;
  appId: Address;
  abiEncodings: AppABIEncodings;
  asset: BlockchainAsset;
  myDeposit: BigNumber;
  peerDeposit: BigNumber;
  timeout: BigNumber;
  initialState: SolidityABIEncoderV2Struct;
  proposedByIdentifier: string;
  proposedToIdentifier: string;
  intermediaries?: string[];

  constructor(
    proposeParams: IProposedAppInstanceInfo,
    channel?: StateChannel,
    overrideId?: Bytes32
  ) {
    this.appId = proposeParams.appId;
    this.abiEncodings = proposeParams.abiEncodings;
    this.asset = proposeParams.asset;
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
      addr: this.appId,
      ...this.abiEncodings
    };

    const proposedTerms: Terms = {
      assetType: this.asset.assetType,
      // FIXME: xuanji
      limit: Zero, // bigNumberify(this.myDeposit).add(bigNumberify(this.peerDeposit)),
      token: AddressZero // this.asset.token || AddressZero
    };

    const isVirtualApp = (this.intermediaries || []).length > 0;

    const signingKeys = isVirtualApp
      ? xkeysToSortedKthAddresses(
          [this.proposedByIdentifier, this.proposedToIdentifier],
          1337
        )
      : stateChannel.getNextSigningKeys();

    const owner = isVirtualApp ? AddressZero : stateChannel.multisigAddress;

    const proposedAppInstance = new AppInstance(
      owner,
      signingKeys,
      bigNumberify(this.timeout).toNumber(),
      proposedAppInterface,
      proposedTerms,
      isVirtualApp,
      isVirtualApp ? 1337 : stateChannel.numInstalledApps,
      stateChannel.rootNonceValue,
      this.initialState,
      0,
      bigNumberify(this.timeout).toNumber()
    );

    return proposedAppInstance.identityHash;
  }

  toJson() {
    return {
      id: this.id,
      appId: this.appId,
      abiEncodings: this.abiEncodings,
      asset: this.asset,
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
      appId: json.appId,
      abiEncodings: json.abiEncodings,
      asset: json.asset,
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

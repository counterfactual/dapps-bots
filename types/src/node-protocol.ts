import { BigNumber } from "ethers/utils";

import { ETHBucketAppState } from ".";
import {
  AppABIEncodings,
  AppInstanceInfo,
  BlockchainAsset
} from "./data-types";
import {
  Address,
  AppInstanceID,
  SolidityABIEncoderV2Struct
} from "./simple-types";

export interface INodeProvider {
  onMessage(callback: (message: Node.Message) => void);
  sendMessage(message: Node.Message);
}

export namespace Node {
  export type NetworkContext = {
    // Protocol
    MultiSend: Address;
    NonceRegistry: Address;
    AppRegistry: Address;
    // App-specific
    PaymentApp: Address;
    ETHBalanceRefund: Address;
  };

  export enum ErrorType {
    ERROR = "error"
  }

  // SOURCE: https://github.com/counterfactual/monorepo/blob/master/packages/cf.js/API_REFERENCE.md#public-methods
  export enum MethodName {
    GET_APP_INSTANCES = "getAppInstances",
    GET_PROPOSED_APP_INSTANCES = "getProposedAppInstances",
    GET_FREE_BALANCE_STATE = "getFreeBalanceState",
    GET_MY_FREE_BALANCE_FOR_STATE = "getMyFreeBalanceForState",
    PROPOSE_INSTALL = "proposeInstall",
    PROPOSE_INSTALL_VIRTUAL = "proposeInstallVirtual",
    REJECT_INSTALL = "rejectInstall",
    INSTALL = "install",
    INSTALL_VIRTUAL = "installVirtual",
    WITHDRAW = "withdraw",
    GET_STATE = "getState",
    GET_APP_INSTANCE_DETAILS = "getAppInstanceDetails",
    TAKE_ACTION = "takeAction",
    UNINSTALL = "uninstall",
    UNINSTALL_VIRTUAL = "uninstallVirtual",
    PROPOSE_STATE = "proposeState",
    ACCEPT_STATE = "acceptState",
    REJECT_STATE = "rejectState",
    CREATE_CHANNEL = "createChannel",
    GET_CHANNEL_ADDRESSES = "getChannelAddresses",
    DEPOSIT = "deposit"
  }

  // The events that cf.js clients can listen on
  // SOURCE: https://github.com/counterfactual/monorepo/blob/master/packages/cf.js/API_REFERENCE.md#events
  export enum EventName {
    INSTALL = "installEvent",
    INSTALL_VIRTUAL = "installVirtualEvent",
    REJECT_INSTALL = "rejectInstallEvent",
    UPDATE_STATE = "updateStateEvent",
    UNINSTALL = "uninstallEvent",
    UNINSTALL_VIRTUAL = "uninstallVirtualEvent",
    WITHDRAWAL_STARTED = "withdrawalStartedEvent",
    WITHDRAWAL_CONFIRMED = "withdrawalConfirmedEvent",
    WITHDRAWAL_FAILED = "withdrawalFailed",
    PROPOSE_STATE = "proposeStateEvent",
    REJECT_STATE = "rejectStateEvent",
    CREATE_CHANNEL = "createChannelEvent",
    DEPOSIT_STARTED = "depositStartedEvent",
    DEPOSIT_CONFIRMED = "depositConfirmedEvent",
    DEPOSIT_FAILED = "depositFailed",
    COUNTER_DEPOSIT_CONFIRMED = "counterDepositConfirmed"
  }

  export type DepositParams = {
    multisigAddress: string;
    amount: BigNumber;
    notifyCounterparty?: boolean;
  };
  export type DepositResult = {
    multisigBalance: BigNumber;
  };

  export type WithdrawParams = {
    multisigAddress: string;
    recipient?: string;
    amount: BigNumber;
  };
  export type WithdrawResult = {
    recipient: string;
    amount: BigNumber;
  };

  export type GetFreeBalanceStateParams = {
    multisigAddress: string;
  };

  export type GetFreeBalanceStateResult = {
    state: ETHBucketAppState;
  };

  export type GetMyFreeBalanceForStateParams = {
    multisigAddress: string;
  };

  export type GetMyFreeBalanceForStateResult = {
    balance: BigNumber;
  };

  export type GetAppInstancesParams = {};
  export type GetProposedAppInstancesParams = {};

  export type GetAppInstancesResult = {
    appInstances: AppInstanceInfo[];
  };
  export type GetProposedAppInstancesResult = {
    appInstances: AppInstanceInfo[];
  };

  export type ProposeInstallParams = {
    appId: Address;
    abiEncodings: AppABIEncodings;
    asset: BlockchainAsset;
    myDeposit: BigNumber;
    peerDeposit: BigNumber;
    timeout: BigNumber;
    initialState: SolidityABIEncoderV2Struct;
    proposedToIdentifier: string;
  };
  export type ProposeInstallResult = {
    appInstanceId: AppInstanceID;
  };

  export type ProposeInstallVirtualParams = ProposeInstallParams & {
    intermediaries: string[];
  };
  export type ProposeInstallVirtualResult = ProposeInstallResult;

  export type RejectInstallParams = {
    appInstanceId: AppInstanceID;
  };
  export type RejectInstallResult = {};

  export type InstallParams = {
    appInstanceId: AppInstanceID;
  };
  export type InstallResult = {
    appInstance: AppInstanceInfo;
  };

  export type InstallVirtualParams = InstallParams & {
    intermediaries: string[];
  };
  export type InstallVirtualResult = InstallResult;

  export type GetStateParams = {
    appInstanceId: AppInstanceID;
  };
  export type GetStateResult = {
    state: SolidityABIEncoderV2Struct;
  };

  export type GetAppInstanceDetailsParams = {
    appInstanceId: AppInstanceID;
  };
  export type GetAppInstanceDetailsResult = {
    appInstance: AppInstanceInfo;
  };

  export type TakeActionParams = {
    appInstanceId: AppInstanceID;
    action: SolidityABIEncoderV2Struct;
  };
  export type TakeActionResult = {
    newState: SolidityABIEncoderV2Struct;
  };

  export type UninstallParams = {
    appInstanceId: AppInstanceID;
  };
  export type UninstallResult = {};

  export type UninstallVirtualParams = UninstallParams & {
    intermediaryIdentifier: string;
  };
  export type UninstallVirtualResult = UninstallResult;

  export type CreateChannelParams = {
    owners: Address[];
  };
  export type CreateChannelTransactionResult = {
    transactionHash: string;
  };
  export type CreateChannelResult = {
    multisigAddress: string;
    owners: string[];
    counterpartyXpub: string;
  };

  export type GetChannelAddressesParams = {};
  export type GetChannelAddressesResult = {
    multisigAddresses: Address[];
  };

  export type MethodParams =
    | GetAppInstancesParams
    | GetProposedAppInstancesParams
    | ProposeInstallParams
    | ProposeInstallVirtualParams
    | RejectInstallParams
    | InstallParams
    | InstallVirtualParams
    | GetStateParams
    | GetAppInstanceDetailsParams
    | TakeActionParams
    | UninstallParams
    | CreateChannelParams
    | GetChannelAddressesParams;
  export type MethodResult =
    | GetAppInstancesResult
    | GetProposedAppInstancesResult
    | ProposeInstallResult
    | ProposeInstallVirtualResult
    | RejectInstallResult
    | InstallResult
    | InstallVirtualResult
    | GetStateResult
    | GetAppInstanceDetailsResult
    | TakeActionResult
    | UninstallResult
    | CreateChannelResult
    | GetChannelAddressesResult;

  export type InstallEventData = {
    appInstanceId: AppInstanceID;
  };
  export type RejectInstallEventData = {
    appInstance: AppInstanceInfo;
  };
  export type UpdateStateEventData = {
    appInstanceId: AppInstanceID;
    newState: SolidityABIEncoderV2Struct;
    oldState: SolidityABIEncoderV2Struct;
    action?: SolidityABIEncoderV2Struct;
  };
  export type UninstallEventData = {
    appInstanceId: string;
  };
  export type WithdrawEventData = {
    amount: BigNumber;
  };
  export type CreateMultisigEventData = {
    owners: Address[];
    multisigAddress: Address;
  };

  export type EventData =
    | InstallEventData
    | RejectInstallEventData
    | UpdateStateEventData
    | UninstallEventData
    | CreateMultisigEventData;

  export type MethodMessage = {
    type: MethodName;
    requestId: string;
  };

  export type MethodRequest = MethodMessage & {
    params: MethodParams;
  };

  export type MethodResponse = MethodMessage & {
    result: MethodResult;
  };

  export type Event = {
    type: EventName;
    data: EventData;
  };

  export type Error = {
    type: ErrorType;
    requestId?: string;
    data: {
      errorName: string;
      message?: string;
      appInstanceId?: string;
      extra?: { [k: string]: string | number | boolean | object };
    };
  };

  export type Message = MethodRequest | MethodResponse | Event | Error;
}

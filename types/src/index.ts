import {
  AppIdentity,
  AppInstance,
  AppInterface,
  AssetType,
  ETHBucketAppState,
  SignedStateHashUpdate,
  Terms
} from "./app-instance";
import {
  AppABIEncodings,
  AppInstanceInfo,
  BlockchainAsset
} from "./data-types";
import { INodeProvider, Node } from "./node-protocol";
import {
  ABIEncoding,
  Address,
  AppAction,
  AppInstanceID,
  AppState,
  Bytes32
} from "./simple-types";

export interface NetworkContext {
  AppRegistry: string;
  ETHBalanceRefund: string;
  ETHBucket: string;
  MultiSend: string;
  NonceRegistry: string;
  StateChannelTransaction: string;
}

export {
  ABIEncoding,
  Address,
  AppABIEncodings,
  AppAction,
  AppIdentity,
  AppInstance,
  AppInstanceID,
  AppInstanceInfo,
  AppInterface,
  AppState,
  AssetType,
  BlockchainAsset,
  Bytes32,
  ETHBucketAppState,
  INodeProvider,
  Node,
  SignedStateHashUpdate,
  Terms
};

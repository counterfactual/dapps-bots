import {
  Address,
  AppABIEncodings,
  AppInstanceID,
  AppInstanceInfo,
  AssetType,
  BlockchainAsset,
  NetworkContext,
  networkContextProps,
  Node as NodeTypes,
  SolidityABIEncoderV2Type
} from "@counterfactual/types";
import { AddressZero, One, Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";
import { v4 as generateUUID } from "uuid";

import {
  CreateChannelMessage,
  InstallVirtualMessage,
  Node,
  NODE_EVENTS,
  ProposeMessage,
  ProposeVirtualMessage
} from "../../src";
import { APP_INSTANCE_STATUS } from "../../src/db-schema";
import { xkeyKthAddress } from "../../src/machine";

import {
  initialEmptyTTTState,
  tttActionEncoding,
  tttStateEncoding
} from "./tic-tac-toe";

/**
 * Even though this function returns a transaction hash, the calling Node
 * will receive an event (CREATE_CHANNEL) that should be subscribed to to
 * ensure a channel has been instantiated and to get its multisig address
 * back in the event data.
 */
export async function getMultisigCreationTransactionHash(
  node: Node,
  xpubs: string[]
): Promise<Address> {
  const req: NodeTypes.MethodRequest = {
    requestId: generateUUID(),
    type: NodeTypes.MethodName.CREATE_CHANNEL,
    params: {
      owners: xpubs
    } as NodeTypes.CreateChannelParams
  };
  const response: NodeTypes.MethodResponse = await node.call(req.type, req);
  const result = response.result as NodeTypes.CreateChannelTransactionResult;
  return result.transactionHash;
}

/**
 * Wrapper method making the call to the given node to get the list of
 * multisig addresses the node is aware of.
 * @param node
 * @returns list of multisig addresses
 */
export async function getChannelAddresses(node: Node): Promise<Set<string>> {
  const req: NodeTypes.MethodRequest = {
    requestId: generateUUID(),
    type: NodeTypes.MethodName.GET_CHANNEL_ADDRESSES,
    params: {} as NodeTypes.CreateChannelParams
  };
  const response: NodeTypes.MethodResponse = await node.call(req.type, req);
  const result = response.result as NodeTypes.GetChannelAddressesResult;
  return new Set(result.multisigAddresses);
}

export async function getInstalledAppInstances(
  node: Node
): Promise<AppInstanceInfo[]> {
  return getApps(node, APP_INSTANCE_STATUS.INSTALLED);
}

export async function getInstalledAppInstanceInfo(
  node: Node,
  appInstanceId: string
): Promise<AppInstanceInfo> {
  const allAppInstanceInfos = await getApps(
    node,
    APP_INSTANCE_STATUS.INSTALLED
  );
  return allAppInstanceInfos.filter(appInstanceInfo => {
    return appInstanceInfo.id === appInstanceId;
  })[0];
}

export async function getProposedAppInstances(
  node: Node
): Promise<AppInstanceInfo[]> {
  return getApps(node, APP_INSTANCE_STATUS.PROPOSED);
}

export async function getProposedAppInstanceInfo(
  node: Node,
  appInstanceId: string
): Promise<AppInstanceInfo> {
  const allProposedAppInstanceInfos = await getApps(
    node,
    APP_INSTANCE_STATUS.PROPOSED
  );
  return allProposedAppInstanceInfos.filter(appInstanceInfo => {
    return appInstanceInfo.id === appInstanceId;
  })[0];
}

export async function getFreeBalanceState(
  node: Node,
  multisigAddress: string
): Promise<NodeTypes.GetFreeBalanceStateResult> {
  const req = {
    requestId: generateUUID(),
    type: NodeTypes.MethodName.GET_FREE_BALANCE_STATE,
    params: {
      multisigAddress
    }
  };
  const response = await node.call(req.type, req);
  return response.result as NodeTypes.GetFreeBalanceStateResult;
}

export async function getApps(
  node: Node,
  appInstanceStatus: APP_INSTANCE_STATUS
): Promise<AppInstanceInfo[]> {
  let request: NodeTypes.MethodRequest;
  let response: NodeTypes.MethodResponse;
  let result;
  if (appInstanceStatus === APP_INSTANCE_STATUS.INSTALLED) {
    request = {
      requestId: generateUUID(),
      type: NodeTypes.MethodName.GET_APP_INSTANCES,
      params: {} as NodeTypes.GetAppInstancesParams
    };
    response = await node.call(request.type, request);
    result = response.result as NodeTypes.GetAppInstancesResult;
    return result.appInstances;
  }
  request = {
    requestId: generateUUID(),
    type: NodeTypes.MethodName.GET_PROPOSED_APP_INSTANCES,
    params: {} as NodeTypes.GetProposedAppInstancesParams
  };
  response = await node.call(request.type, request);
  result = response.result as NodeTypes.GetProposedAppInstancesResult;
  return result.appInstances;
}

export function makeDepositRequest(
  multisigAddress: string,
  amount: BigNumber
): NodeTypes.MethodRequest {
  return {
    requestId: generateUUID(),
    type: NodeTypes.MethodName.DEPOSIT,
    params: {
      multisigAddress,
      amount
    } as NodeTypes.DepositParams
  };
}

export function makeWithdrawRequest(
  multisigAddress: string,
  amount: BigNumber
): NodeTypes.MethodRequest {
  return {
    requestId: generateUUID(),
    type: NodeTypes.MethodName.WITHDRAW,
    params: {
      multisigAddress,
      amount
    } as NodeTypes.WithdrawParams
  };
}

export function makeInstallRequest(
  appInstanceId: string
): NodeTypes.MethodRequest {
  return {
    requestId: generateUUID(),
    type: NodeTypes.MethodName.INSTALL,
    params: {
      appInstanceId
    } as NodeTypes.InstallParams
  };
}

export function makeRejectInstallRequest(
  appInstanceId: string
): NodeTypes.MethodRequest {
  return {
    requestId: generateUUID(),
    type: NodeTypes.MethodName.REJECT_INSTALL,
    params: {
      appInstanceId
    } as NodeTypes.RejectInstallParams
  };
}

export function makeTTTProposalRequest(
  proposedByIdentifier: string,
  proposedToIdentifier: string,
  appId: string,
  state: SolidityABIEncoderV2Type = {},
  myDeposit: BigNumber = Zero,
  peerDeposit: BigNumber = Zero
): NodeTypes.MethodRequest {
  const initialState =
    Object.keys(state).length !== 0
      ? state
      : initialEmptyTTTState([
          xkeyKthAddress(proposedByIdentifier, 0),
          xkeyKthAddress(proposedToIdentifier, 0)
        ]);

  const params: NodeTypes.ProposeInstallParams = {
    proposedToIdentifier,
    myDeposit,
    peerDeposit,
    appId,
    initialState,
    abiEncodings: {
      stateEncoding: tttStateEncoding,
      actionEncoding: tttActionEncoding
    } as AppABIEncodings,
    asset: {
      assetType: AssetType.ETH
    } as BlockchainAsset,
    timeout: One
  };
  return {
    params,
    requestId: generateUUID(),
    type: NodeTypes.MethodName.PROPOSE_INSTALL
  } as NodeTypes.MethodRequest;
}

export function makeInstallVirtualRequest(
  appInstanceId: string,
  intermediaries: Address[]
): NodeTypes.MethodRequest {
  return {
    params: {
      appInstanceId,
      intermediaries
    } as NodeTypes.InstallVirtualParams,
    requestId: generateUUID(),
    type: NodeTypes.MethodName.INSTALL_VIRTUAL
  };
}

export function makeTTTVirtualProposalRequest(
  proposedByIdentifier: string,
  proposedToIdentifier: string,
  intermediaries: string[],
  appId: string,
  initialState: SolidityABIEncoderV2Type = {},
  myDeposit: BigNumber = Zero,
  peerDeposit: BigNumber = Zero
): NodeTypes.MethodRequest {
  const installProposalParams = makeTTTProposalRequest(
    proposedByIdentifier,
    proposedToIdentifier,
    appId,
    initialState,
    myDeposit,
    peerDeposit
  ).params as NodeTypes.ProposeInstallParams;

  const installVirtualParams: NodeTypes.ProposeInstallVirtualParams = {
    ...installProposalParams,
    intermediaries
  };
  return {
    params: installVirtualParams,
    requestId: generateUUID(),
    type: NodeTypes.MethodName.PROPOSE_INSTALL_VIRTUAL
  } as NodeTypes.MethodRequest;
}

/**
 * @param proposalParams The parameters of the installation proposal.
 * @param proposedAppInstanceInfo The proposed app instance contained in the Node.
 */
export function confirmProposedAppInstanceOnNode(
  methodParams: NodeTypes.MethodParams,
  proposedAppInstanceInfo: AppInstanceInfo,
  nonInitiatingNode: boolean = false
) {
  const proposalParams = methodParams as NodeTypes.ProposeInstallParams;
  expect(proposalParams.abiEncodings).toEqual(
    proposedAppInstanceInfo.abiEncodings
  );
  expect(proposalParams.appId).toEqual(proposedAppInstanceInfo.appId);
  expect(proposalParams.asset).toEqual(proposedAppInstanceInfo.asset);
  if (nonInitiatingNode) {
    expect(proposalParams.myDeposit).toEqual(
      proposedAppInstanceInfo.peerDeposit
    );
    expect(proposalParams.peerDeposit).toEqual(
      proposedAppInstanceInfo.myDeposit
    );
  } else {
    expect(proposalParams.myDeposit).toEqual(proposedAppInstanceInfo.myDeposit);
    expect(proposalParams.peerDeposit).toEqual(
      proposedAppInstanceInfo.peerDeposit
    );
  }
  expect(proposalParams.timeout).toEqual(proposedAppInstanceInfo.timeout);
  // TODO: uncomment when getState is implemented
  // expect(proposalParams.initialState).toEqual(appInstanceInitialState);
}

export function confirmProposedVirtualAppInstanceOnNode(
  methodParams: NodeTypes.MethodParams,
  proposedAppInstance: AppInstanceInfo,
  nonInitiatingNode: boolean = false
) {
  confirmProposedAppInstanceOnNode(
    methodParams,
    proposedAppInstance,
    nonInitiatingNode
  );
  const proposalParams = methodParams as NodeTypes.ProposeInstallVirtualParams;
  expect(proposalParams.intermediaries).toEqual(
    proposedAppInstance.intermediaries
  );
}

const emptyNetworkMap = new Map(
  networkContextProps.map((i): [string, string] => [i, AddressZero])
);
export const EMPTY_NETWORK = Array.from(emptyNetworkMap.entries()).reduce(
  (main, [key, value]) => ({ ...main, [key]: value }),
  {}
) as NetworkContext;

export function generateGetStateRequest(
  appInstanceId: AppInstanceID
): NodeTypes.MethodRequest {
  return {
    params: {
      appInstanceId
    },
    requestId: generateUUID(),
    type: NodeTypes.MethodName.GET_STATE
  };
}

export function generateTakeActionRequest(
  appInstanceId: AppInstanceID,
  action: any
): NodeTypes.MethodRequest {
  return {
    params: {
      appInstanceId,
      action
    } as NodeTypes.TakeActionParams,
    requestId: generateUUID(),
    type: NodeTypes.MethodName.TAKE_ACTION
  };
}

export function generateUninstallRequest(
  appInstanceId: AppInstanceID
): NodeTypes.MethodRequest {
  return {
    params: {
      appInstanceId
    } as NodeTypes.UninstallParams,
    requestId: generateUUID(),
    type: NodeTypes.MethodName.UNINSTALL
  };
}

export function generateUninstallVirtualRequest(
  appInstanceId: AppInstanceID,
  intermediaryIdentifier: string
): NodeTypes.MethodRequest {
  return {
    params: {
      appInstanceId,
      intermediaryIdentifier
    } as NodeTypes.UninstallVirtualParams,
    requestId: generateUUID(),
    type: NodeTypes.MethodName.UNINSTALL_VIRTUAL
  };
}

export function sleep(timeInMilliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, timeInMilliseconds));
}

export async function collateralizeChannel(
  node1: Node,
  node2: Node,
  multisigAddress: string
): Promise<void> {
  const depositReq = makeDepositRequest(multisigAddress, One);
  await node1.call(depositReq.type, depositReq);
  await node2.call(depositReq.type, depositReq);
}

export async function createChannel(nodeA: Node, nodeB: Node): Promise<string> {
  return new Promise(async (resolve, reject) => {
    nodeA.on(NODE_EVENTS.CREATE_CHANNEL, async (msg: CreateChannelMessage) => {
      expect(await getInstalledAppInstances(nodeA)).toEqual([]);
      expect(await getInstalledAppInstances(nodeB)).toEqual([]);
      resolve(msg.data.multisigAddress);
    });

    await getMultisigCreationTransactionHash(nodeA, [
      nodeA.publicIdentifier,
      nodeB.publicIdentifier
    ]);
  });
}

export async function installTTTApp(
  nodeA: Node,
  nodeB: Node,
  initialState?: SolidityABIEncoderV2Type
): Promise<string> {
  const initialTTTState: SolidityABIEncoderV2Type = initialState
    ? initialState
    : initialEmptyTTTState([
        xkeyKthAddress(nodeA.publicIdentifier, 0), // <-- winner
        xkeyKthAddress(nodeB.publicIdentifier, 0)
      ]);

  return new Promise(async (resolve, reject) => {
    const appInstanceInstallationProposalRequest = makeTTTProposalRequest(
      nodeA.publicIdentifier,
      nodeB.publicIdentifier,
      global["networkContext"].TicTacToe,
      initialTTTState
    );

    let appInstanceId: string;

    nodeB.on(NODE_EVENTS.PROPOSE_INSTALL, async (msg: ProposeMessage) => {
      confirmProposedAppInstanceOnNode(
        appInstanceInstallationProposalRequest.params,
        await getProposedAppInstanceInfo(nodeA, appInstanceId)
      );

      const installRequest = makeInstallRequest(msg.data.appInstanceId);
      nodeB.emit(installRequest.type, installRequest);
    });

    nodeA.on(NODE_EVENTS.INSTALL, async () => {
      const appInstanceNodeA = await getInstalledAppInstanceInfo(
        nodeA,
        appInstanceId
      );
      const appInstanceNodeB = await getInstalledAppInstanceInfo(
        nodeB,
        appInstanceId
      );
      expect(appInstanceNodeA).toEqual(appInstanceNodeB);
      resolve(appInstanceId);
    });

    const response = await nodeA.call(
      appInstanceInstallationProposalRequest.type,
      appInstanceInstallationProposalRequest
    );
    appInstanceId = (response.result as NodeTypes.ProposeInstallResult)
      .appInstanceId;
  });
}

export async function installTTTAppVirtual(
  nodeA: Node,
  nodeB: Node,
  nodeC: Node,
  initialState?: SolidityABIEncoderV2Type
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    nodeA.on(
      NODE_EVENTS.INSTALL_VIRTUAL,
      async (msg: InstallVirtualMessage) => {
        resolve(msg.data.params.appInstanceId);
      }
    );

    nodeC.on(
      NODE_EVENTS.PROPOSE_INSTALL_VIRTUAL,
      (msg: ProposeVirtualMessage) => {
        const installReq = makeInstallVirtualRequest(
          msg.data.appInstanceId,
          msg.data.params.intermediaries
        );
        nodeC.emit(installReq.type, installReq);
      }
    );

    await makeTTTVirtualProposal(nodeA, nodeC, nodeB, initialState);
  });
}

export async function confirmChannelCreation(
  nodeA: Node,
  nodeB: Node,
  ownersPublicIdentifiers: string[],
  data: NodeTypes.CreateChannelResult
) {
  const openChannelsNodeA = await getChannelAddresses(nodeA);
  const openChannelsNodeB = await getChannelAddresses(nodeB);

  expect(openChannelsNodeA.has(data.multisigAddress)).toBeTruthy();
  expect(openChannelsNodeB.has(data.multisigAddress)).toBeTruthy();
  expect(data.owners).toEqual(ownersPublicIdentifiers);
}

export async function confirmAppInstanceInstallation(
  proposedParams: NodeTypes.ProposeInstallParams,
  appInstanceInfo: AppInstanceInfo
) {
  delete appInstanceInfo.proposedByIdentifier;
  delete appInstanceInfo.intermediaries;
  delete appInstanceInfo.id;
  expect(appInstanceInfo).toEqual(proposedParams);
}

export async function getState(
  nodeA: Node,
  appInstanceId: string
): Promise<SolidityABIEncoderV2Type> {
  const getStateReq = generateGetStateRequest(appInstanceId);
  const getStateResult = await nodeA.call(getStateReq.type, getStateReq);
  return (getStateResult.result as NodeTypes.GetStateResult).state;
}

export function playerAddresses(nodes: Node[]): string[] {
  return nodes.map<string>((node: Node) => {
    return xkeyKthAddress(node.publicIdentifier, 0);
  });
}

export async function makeTTTVirtualProposal(
  nodeA: Node,
  nodeC: Node,
  nodeB: Node,
  initialState: SolidityABIEncoderV2Type = {}
): Promise<{
  appInstanceId: string;
  params: NodeTypes.ProposeInstallVirtualParams;
}> {
  const virtualAppInstanceProposalRequest: NodeTypes.MethodRequest = makeTTTVirtualProposalRequest(
    nodeA.publicIdentifier,
    nodeC.publicIdentifier,
    [nodeB.publicIdentifier],
    global["networkContext"].TicTacToe,
    initialState,
    One,
    Zero
  );
  const params = virtualAppInstanceProposalRequest.params as NodeTypes.ProposeInstallVirtualParams;
  const response = await nodeA.call(
    virtualAppInstanceProposalRequest.type,
    virtualAppInstanceProposalRequest
  );
  const appInstanceId = (response.result as NodeTypes.ProposeInstallVirtualResult)
    .appInstanceId;
  expect(appInstanceId).toBeDefined();
  return { appInstanceId, params };
}

export function installTTTVirtual(
  node: Node,
  appInstanceId: string,
  intermediaries: string[]
) {
  const installVirtualReq = makeInstallVirtualRequest(
    appInstanceId,
    intermediaries
  );
  node.emit(installVirtualReq.type, installVirtualReq);
}

export function makeInstallCall(node: Node, appInstanceId: string) {
  const installRequest = makeInstallRequest(appInstanceId);
  node.emit(installRequest.type, installRequest);
}

export async function makeVirtualProposeCall(
  nodeA: Node,
  nodeC: Node,
  nodeB: Node
): Promise<{
  appInstanceId: string;
  params: NodeTypes.ProposeInstallVirtualParams;
}> {
  const virtualAppInstanceProposalRequest = makeTTTVirtualProposalRequest(
    nodeA.publicIdentifier,
    nodeC.publicIdentifier,
    [nodeB.publicIdentifier],
    global["networkContext"].TicTacToe
  );
  const response = await nodeA.call(
    virtualAppInstanceProposalRequest.type,
    virtualAppInstanceProposalRequest
  );
  return {
    appInstanceId: (response.result as NodeTypes.ProposeInstallVirtualResult)
      .appInstanceId,
    params: virtualAppInstanceProposalRequest.params as NodeTypes.ProposeInstallVirtualParams
  };
}

export async function makeProposeCall(
  nodeA: Node,
  nodeB: Node
): Promise<{
  appInstanceId: string;
  params: NodeTypes.ProposeInstallParams;
}> {
  const appInstanceProposalReq = makeTTTProposalRequest(
    nodeA.publicIdentifier,
    nodeB.publicIdentifier,
    global["networkContext"].TicTacToe,
    {},
    One,
    Zero
  );

  const response = await nodeA.call(
    appInstanceProposalReq.type,
    appInstanceProposalReq
  );
  return {
    appInstanceId: (response.result as NodeTypes.ProposeInstallResult)
      .appInstanceId,
    params: appInstanceProposalReq.params as NodeTypes.ProposeInstallParams
  };
}

export function sanitizeAppInstances(appInstances: AppInstanceInfo[]) {
  appInstances.forEach((appInstance: AppInstanceInfo) => {
    delete appInstance.myDeposit;
    delete appInstance.peerDeposit;
  });
}

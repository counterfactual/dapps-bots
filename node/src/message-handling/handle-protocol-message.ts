import { SolidityValueType } from "@counterfactual/types";

import {
  InstallParams,
  InstallVirtualAppParams,
  Protocol,
  SetupParams,
  TakeActionParams,
  UninstallParams,
  UninstallVirtualAppParams,
  UpdateParams,
  WithdrawParams
} from "../machine";
import { ProtocolParameters } from "../machine/types";
import { executeFunctionWithinQueues } from "../methods/queued-execution";
import { StateChannel } from "../models";
import { UNASSIGNED_SEQ_NO } from "../protocol/utils/signature-forwarder";
import { RequestHandler } from "../request-handler";
import RpcRouter from "../rpc-router";
import { NODE_EVENTS, NodeMessageWrappedProtocolMessage } from "../types";
import { bigNumberifyJson, getCreate2MultisigAddress } from "../utils";

/**
 * Forwards all received NodeMessages that are for the machine's internal
 * protocol execution directly to the instructionExecutor's message handler:
 * `runProtocolWithMessage`
 */
export async function handleReceivedProtocolMessage(
  requestHandler: RequestHandler,
  msg: NodeMessageWrappedProtocolMessage
) {
  const {
    publicIdentifier,
    instructionExecutor,
    store,
    router
  } = requestHandler;

  const { data } = bigNumberifyJson(msg) as NodeMessageWrappedProtocolMessage;

  const { protocol, seq, params } = data;

  if (seq === UNASSIGNED_SEQ_NO) return;

  const preProtocolStateChannelsMap = await store.getStateChannelsMap();

  const queueNames = await getQueueNamesListByProtocolName(
    protocol,
    params,
    requestHandler
  );

  const postProtocolStateChannelsMap = await executeFunctionWithinQueues(
    queueNames.map(requestHandler.getShardedQueue.bind(requestHandler)),
    async () => {
      const stateChannelsMap = await instructionExecutor.runProtocolWithMessage(
        data,
        preProtocolStateChannelsMap
      );

      for (const stateChannel of stateChannelsMap.values()) {
        await store.saveStateChannel(stateChannel);
      }

      return stateChannelsMap;
    }
  );

  const outgoingEventData = getOutgoingEventDataFromProtocol(
    protocol,
    params,
    publicIdentifier,
    postProtocolStateChannelsMap
  );

  if (outgoingEventData) {
    await emitOutgoingNodeMessage(router, outgoingEventData);
  }
}

function emitOutgoingNodeMessage(router: RpcRouter, msg: object) {
  return router.emit(msg["type"], msg, "outgoing");
}

function getOutgoingEventDataFromProtocol(
  protocol: string,
  params: ProtocolParameters,
  publicIdentifier: string,
  stateChannelsMap: Map<string, StateChannel>
) {
  const baseEvent = { from: publicIdentifier };

  switch (protocol) {
    case Protocol.Install:
      // TODO: Have to take an InstallParams object and somehow compute the
      //       appInstanceIdentityHash from it and then emit an event with
      //       that value inside of it.
      return;
    case Protocol.Uninstall:
      return {
        ...baseEvent,
        type: NODE_EVENTS.UNINSTALL,
        data: getUninstallEventData(params as UninstallParams)
      };
    case Protocol.Setup:
      return {
        ...baseEvent,
        type: NODE_EVENTS.CREATE_CHANNEL,
        data: getSetupEventData(
          params as SetupParams,
          stateChannelsMap.get((params as SetupParams).multisigAddress)!
            .multisigOwners
        )
      };
    case Protocol.Withdraw:
      return {
        ...baseEvent,
        type: NODE_EVENTS.WITHDRAWAL_CONFIRMED,
        data: getWithdrawEventData(params as WithdrawParams)
      };
    case Protocol.TakeAction:
    case Protocol.Update:
      return {
        ...baseEvent,
        type: NODE_EVENTS.UPDATE_STATE,
        data: getStateUpdateEventData(
          params as UpdateParams,
          stateChannelsMap
            .get((params as TakeActionParams | UpdateParams).multisigAddress)!
            .getAppInstance(
              (params as TakeActionParams | UpdateParams).appIdentityHash
            )!.state
        )
      };
    case Protocol.InstallVirtualApp:
      // TODO: Have to take an InstallParams object and somehow compute the
      //       appInstanceIdentityHash from it and then emit an event with
      //       that value inside of it.
      return;
    case Protocol.UninstallVirtualApp:
      return {
        ...baseEvent,
        type: NODE_EVENTS.UNINSTALL_VIRTUAL,
        data: getUninstallVirtualAppEventData(
          params as UninstallVirtualAppParams
        )
      };
    default:
      throw new Error(
        `handleReceivedProtocolMessage received invalid protocol message: ${protocol}`
      );
  }
}

function getStateUpdateEventData(
  { appIdentityHash: appInstanceId }: TakeActionParams | UpdateParams,
  newState: SolidityValueType
) {
  return { newState, appInstanceId };
}

function getUninstallVirtualAppEventData({
  intermediaryXpub: intermediaryIdentifier,
  targetAppIdentityHash: appInstanceId
}: UninstallVirtualAppParams) {
  return { appInstanceId, intermediaryIdentifier };
}

function getUninstallEventData({
  appIdentityHash: appInstanceId
}: UninstallParams) {
  return { appInstanceId };
}

function getWithdrawEventData({ amount }: WithdrawParams) {
  return amount;
}

function getSetupEventData(
  { initiatorXpub: counterpartyXpub, multisigAddress }: SetupParams,
  owners: string[]
) {
  return { multisigAddress, owners, counterpartyXpub };
}

/**
 * Produces an array of queues that the client must halt execution on
 * for some particular protocol and its set of parameters/
 *
 * @param {string} protocol - string name of the protocol
 * @param {ProtocolParameters} params - parameters relevant for the protocol
 * @param {Store} store - the store the client is connected to
 * @param {RequestHandler} requestHandler - the request handler object of the client
 *
 * @returns {Promise<string[]>} - list of the names of the queues
 */
async function getQueueNamesListByProtocolName(
  protocol: string,
  params: ProtocolParameters,
  requestHandler: RequestHandler
): Promise<string[]> {
  const { publicIdentifier, networkContext } = requestHandler;

  function multisigAddressFor(xpubs: string[]) {
    return getCreate2MultisigAddress(
      xpubs,
      networkContext.ProxyFactory,
      networkContext.MinimumViableMultisig
    );
  }

  switch (protocol) {
    /**
     * Queue on the multisig address of the direct channel.
     */
    case Protocol.Install:
    case Protocol.Setup:
    case Protocol.Uninstall:
    case Protocol.Withdraw:
      const { multisigAddress } = params as
        | InstallParams
        | SetupParams
        | UninstallParams
        | WithdrawParams;

      return [multisigAddress];

    /**
     * Queue on the appInstanceId of the AppInstance.
     */
    case Protocol.TakeAction:
    case Protocol.Update:
      const { appIdentityHash } = params as TakeActionParams | UpdateParams;

      return [appIdentityHash];

    /**
     * Queue on the multisig addresses of both direct channels involved.
     */
    case Protocol.InstallVirtualApp:
    case Protocol.UninstallVirtualApp:
      const { initiatorXpub, intermediaryXpub, responderXpub } = params as
        | UninstallVirtualAppParams
        | InstallVirtualAppParams;

      if (publicIdentifier === intermediaryXpub) {
        return [
          multisigAddressFor([initiatorXpub, intermediaryXpub]),
          multisigAddressFor([responderXpub, intermediaryXpub])
        ];
      }

      if (publicIdentifier === responderXpub) {
        return [
          multisigAddressFor([responderXpub, intermediaryXpub]),
          multisigAddressFor([responderXpub, initiatorXpub])
        ];
      }

    // NOTE: This file is only reachable if a protocol message is sent
    // from an initiator to an intermediary, an intermediary to
    // a responder, or an initiator to a responder. It is never possible
    // for the publicIdentifier to be the initiatorXpub, so we ignore
    // that case.

    default:
      throw new Error(
        `handleReceivedProtocolMessage received invalid protocol message: ${protocol}`
      );
  }
}

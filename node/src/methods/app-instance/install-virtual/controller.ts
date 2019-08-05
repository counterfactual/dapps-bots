import { Node } from "@counterfactual/types";
import Queue from "p-queue";
import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../../request-handler";
import { InstallVirtualMessage, NODE_EVENTS } from "../../../types";
import { getCreate2MultisigAddress } from "../../../utils";
import { NodeController } from "../../controller";
import { NO_MULTISIG_FOR_APP_INSTANCE_ID } from "../../errors";

import { installVirtual } from "./operation";

export default class InstallVirtualController extends NodeController {
  public static readonly methodName = Node.MethodName.INSTALL_VIRTUAL;

  @jsonRpcMethod(Node.RpcMethodName.INSTALL_VIRTUAL)
  public executeMethod = super.executeMethod;

  protected async enqueueByShard(
    requestHandler: RequestHandler,
    params: Node.InstallVirtualParams
  ): Promise<Queue[]> {
    const { store, publicIdentifier, networkContext } = requestHandler;
    const { appInstanceId, intermediaries } = params;

    const multisigAddress = getCreate2MultisigAddress(
      [publicIdentifier, intermediaries[0]],
      networkContext.ProxyFactory,
      networkContext.MinimumViableMultisig
    );

    const queues = [requestHandler.getShardedQueue(multisigAddress)];

    try {
      const metachannel = await store.getChannelFromAppInstanceID(
        appInstanceId
      );
      queues.push(requestHandler.getShardedQueue(metachannel.multisigAddress));
    } catch (e) {
      // It is possible the metachannel has never been created
      if (e !== NO_MULTISIG_FOR_APP_INSTANCE_ID) throw e;
    }

    return queues;
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: Node.InstallVirtualParams
  ) {
    const { store, publicIdentifier, networkContext } = requestHandler;
    const { intermediaries } = params;

    if (intermediaries.length === 0) {
      throw new Error(
        "Cannot install virtual app: you did not provide an intermediary."
      );
    }

    if (intermediaries.length > 1) {
      throw new Error(
        "Cannot install virtual app: Node only support single-hop virtual apps at the moment."
      );
    }

    const multisigAddress = getCreate2MultisigAddress(
      [publicIdentifier, intermediaries[0]],
      networkContext.ProxyFactory,
      networkContext.MinimumViableMultisig
    );

    const stateChannelWithIntermediary = await store.getStateChannel(
      multisigAddress
    );

    if (!stateChannelWithIntermediary) {
      throw new Error(
        "Cannot install virtual app: you do not have a channel with the intermediary provided."
      );
    }

    if (!stateChannelWithIntermediary.freeBalance) {
      throw new Error(
        "Cannot install virtual app: channel with intermediary has no free balance app instance installed."
      );
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: Node.InstallVirtualParams
  ): Promise<Node.InstallVirtualResult> {
    const {
      store,
      instructionExecutor,
      publicIdentifier,
      messagingService
    } = requestHandler;

    const { appInstanceId } = params;

    await store.getAppInstanceProposal(appInstanceId);

    const appInstanceProposal = await installVirtual(
      store,
      instructionExecutor,
      params
    );

    const installVirtualApprovalMsg: InstallVirtualMessage = {
      from: publicIdentifier,
      type: NODE_EVENTS.INSTALL_VIRTUAL,
      data: {
        params: {
          appInstanceId
        }
      }
    };

    // TODO: Remove this and add a handler in protocolMessageEventController
    await messagingService.send(
      appInstanceProposal.proposedByIdentifier,
      installVirtualApprovalMsg
    );

    return {
      appInstance: (await store.getAppInstance(appInstanceId)).toJson()
    };
  }
}

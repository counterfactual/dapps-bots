import { Node } from "@counterfactual/types";
import Queue from "p-queue";
import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../../request-handler";
import { NODE_EVENTS, UninstallMessage } from "../../../types";
import { getCounterpartyAddress } from "../../../utils";
import { NodeController } from "../../controller";
import {
  APP_ALREADY_UNINSTALLED,
  CANNOT_UNINSTALL_FREE_BALANCE,
  NO_APP_INSTANCE_ID_TO_UNINSTALL
} from "../../errors";

import { uninstallAppInstanceFromChannel } from "./operation";

export default class UninstallController extends NodeController {
  public static readonly methodName = Node.MethodName.UNINSTALL;

  @jsonRpcMethod("chan_uninstall")
  public executeMethod = super.executeMethod;

  protected async enqueueByShard(
    requestHandler: RequestHandler,
    params: Node.UninstallVirtualParams
  ): Promise<Queue[]> {
    const { store } = requestHandler;
    const { appInstanceId } = params;

    const sc = await store.getChannelFromAppInstanceID(appInstanceId);
    if (sc.getETHFreeBalance().identityHash === appInstanceId) {
      return Promise.reject(CANNOT_UNINSTALL_FREE_BALANCE(sc.multisigAddress));
    }

    return [
      requestHandler.getShardedQueue(
        await store.getMultisigAddressFromAppInstanceID(sc.multisigAddress)
      )
    ];
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: Node.UninstallParams
  ) {
    const { store } = requestHandler;
    const { appInstanceId } = params;

    const stateChannel = await store.getChannelFromAppInstanceID(appInstanceId);

    if (!stateChannel.hasAppInstance(appInstanceId)) {
      throw new Error(APP_ALREADY_UNINSTALLED(appInstanceId));
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: Node.UninstallParams
  ): Promise<Node.UninstallResult> {
    const {
      store,
      instructionExecutor,
      publicIdentifier,
      messagingService
    } = requestHandler;
    const { appInstanceId } = params;

    if (!appInstanceId) {
      return Promise.reject(NO_APP_INSTANCE_ID_TO_UNINSTALL);
    }

    const stateChannel = await store.getChannelFromAppInstanceID(appInstanceId);

    if (!stateChannel.hasAppInstance(appInstanceId)) {
      throw new Error(APP_ALREADY_UNINSTALLED(appInstanceId));
    }

    const to = getCounterpartyAddress(
      publicIdentifier,
      stateChannel.userNeuteredExtendedKeys
    );

    await uninstallAppInstanceFromChannel(
      store,
      instructionExecutor,
      publicIdentifier,
      to,
      appInstanceId
    );

    const uninstallMsg: UninstallMessage = {
      from: publicIdentifier,
      type: NODE_EVENTS.UNINSTALL,
      data: {
        appInstanceId
      }
    };

    await messagingService.send(to, uninstallMsg);

    return {};
  }
}

import { Node } from "@counterfactual/types";
import Queue from "p-queue";

import { RequestHandler } from "../../../request-handler";
import { NODE_EVENTS, UninstallMessage } from "../../../types";
import { getCounterpartyAddress } from "../../../utils";
import { NodeController } from "../../controller";
import { ERRORS } from "../../errors";

import { uninstallAppInstanceFromChannel } from "./operation";

export default class UninstallController extends NodeController {
  public static readonly methodName = Node.MethodName.UNINSTALL;

  protected async enqueueByShard(
    requestHandler: RequestHandler,
    params: Node.UninstallVirtualParams
  ): Promise<Queue[]> {
    const { store } = requestHandler;
    const { appInstanceId } = params;

    const sc = await store.getChannelFromAppInstanceID(appInstanceId);

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
      throw new Error(ERRORS.APP_ALREADY_UNINSTALLED(appInstanceId));
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
      return Promise.reject(ERRORS.NO_APP_INSTANCE_ID_TO_UNINSTALL);
    }

    const stateChannel = await store.getChannelFromAppInstanceID(appInstanceId);

    if (!stateChannel.hasAppInstance(appInstanceId)) {
      throw new Error(ERRORS.APP_ALREADY_UNINSTALLED(appInstanceId));
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

import { Node } from "@counterfactual/types";
import { jsonRpcMethod } from "rpc-server";

import { RequestHandler } from "../../../request-handler";
import { NodeController } from "../../controller";
import { NO_APP_INSTANCE_ID_TO_GET_DETAILS } from "../../errors";

/**
 * Handles the retrieval of an AppInstance.
 * @param this
 * @param params
 */
export default class GetAppInstanceDetailsController extends NodeController {
  public static readonly methodName = Node.MethodName.GET_APP_INSTANCE_DETAILS;

  @jsonRpcMethod("chan_getAppInstance")
  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: Node.GetAppInstanceDetailsParams
  ): Promise<Node.GetAppInstanceDetailsResult> {
    const { store } = requestHandler;
    const { appInstanceId } = params;

    if (!appInstanceId) {
      Promise.reject(NO_APP_INSTANCE_ID_TO_GET_DETAILS);
    }

    return {
      appInstance: await store.getAppInstanceInfo(appInstanceId)
    };
  }
}

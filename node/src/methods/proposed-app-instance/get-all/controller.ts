import { Node } from "@counterfactual/types";

import { RequestHandler } from "../../../request-handler";

export default async function getProposedAppInstancesController(
  this: RequestHandler
): Promise<Node.GetAppInstancesResult> {
  return {
    appInstances: await this.store.getProposedAppInstances()
  };
}

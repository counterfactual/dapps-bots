import {
  AppInstanceInfo,
  Node as NodeTypes
} from "@counterfactual/common-types";

import { Node } from "../../src";

describe("Node method follows spec - getAppInstances", () => {
  it("can accept a valid call to get app instances", done => {
    const node = new Node();
    const requestId = "1";
    const req: NodeTypes.MethodRequest = {
      requestId,
      type: NodeTypes.MethodName.GET_APP_INSTANCES,
      params: {}
    };

    // Set up listener for the method response
    node.on(req.type, (res: NodeTypes.MethodResponse) => {
      expect(req.type).toEqual(res.type);
      expect(res.requestId).toEqual(requestId);
      expect(res.result).toEqual({
        appInstances: [] as AppInstanceInfo[]
      });
      done();
    });

    // Make the method call
    node.emit(req.type, req);
  });
});

import { Node as NodeTypes } from "@counterfactual/types";
import { One, Zero } from "ethers/constants";

import {
  JsonRpcResponse,
  NO_APP_INSTANCE_FOR_TAKE_ACTION,
  Node,
  NODE_EVENTS,
  UpdateStateMessage
} from "../../src";

import { setup, SetupContext } from "./setup";
import { validAction } from "./tic-tac-toe";
import {
  createChannel,
  generateGetStateRequest,
  generateTakeActionRequest,
  installTTTApp
} from "./utils";

describe("Node method follows spec - takeAction", () => {
  let nodeA: Node;
  let nodeB: Node;

  beforeAll(async () => {
    const context: SetupContext = await setup(global);
    nodeA = context["A"].node;
    nodeB = context["B"].node;
  });

  describe(
    "Node A and B install an AppInstance, Node A takes action, " +
      "Node B confirms receipt of state update",
    () => {
      it("sends takeAction with invalid appInstanceId", async () => {
        const takeActionReq = generateTakeActionRequest("", validAction);

        expect(nodeA.router.dispatch(takeActionReq)).rejects.toEqual(
          NO_APP_INSTANCE_FOR_TAKE_ACTION
        );
      });

      it("can take action", async done => {
        await createChannel(nodeA, nodeB);

        const appInstanceId = await installTTTApp(nodeA, nodeB);

        const expectedNewState = {
          board: [[One, Zero, Zero], [Zero, Zero, Zero], [Zero, Zero, Zero]],
          versionNumber: One,
          winner: Zero
        };

        nodeB.on(NODE_EVENTS.UPDATE_STATE, async (msg: UpdateStateMessage) => {
          /**
           * TEST #1
           * The event emitted by Node C after an action is taken by A
           * sends the appInstanceId and the newState correctly.
           */
          expect(msg.data.appInstanceId).toEqual(appInstanceId);
          expect(msg.data.newState).toEqual(expectedNewState);

          /**
           * TEST #3
           * The database of Node C is correctly updated and querying it works
           */
          const { state } = ((await nodeB.router.dispatch(
            generateGetStateRequest(appInstanceId)
          )) as JsonRpcResponse).result.result as NodeTypes.GetStateResult;

          expect(state).toEqual(expectedNewState);

          done();
        });

        const takeActionReq = generateTakeActionRequest(
          appInstanceId,
          validAction
        );

        /**
         * TEST #2
         * The return value from the call to Node A includes the new state
         */
        const { newState } = ((await nodeA.router.dispatch(
          takeActionReq
        )) as JsonRpcResponse).result.result as NodeTypes.TakeActionResult;

        expect(newState).toEqual(expectedNewState);
      });
    }
  );
});

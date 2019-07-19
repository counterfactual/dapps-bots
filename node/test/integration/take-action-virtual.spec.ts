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
  collateralizeChannel,
  createChannel,
  generateGetStateRequest,
  generateTakeActionRequest,
  installTTTAppVirtual
} from "./utils";

describe("Node method follows spec - takeAction virtual", () => {
  let nodeA: Node;
  let nodeB: Node;
  let nodeC: Node;

  beforeAll(async () => {
    const context: SetupContext = await setup(global, true, true);
    nodeA = context["A"].node;
    nodeB = context["B"].node;
    nodeC = context["C"].node;
  });

  describe(
    "Node A and C install an AppInstance via Node B, Node A takes action, " +
      "Node C confirms receipt of state update",
    () => {
      it("sends takeAction with invalid appInstanceId", () => {
        const takeActionReq = generateTakeActionRequest("", validAction);
        expect(nodeA.rpcRouter.dispatch(takeActionReq)).rejects.toEqual(
          NO_APP_INSTANCE_FOR_TAKE_ACTION
        );
      });

      it("can take action", async done => {
        const multisigAddressAB = await createChannel(nodeA, nodeB);
        const multisigAddressBC = await createChannel(nodeB, nodeC);

        await collateralizeChannel(nodeA, nodeB, multisigAddressAB);
        await collateralizeChannel(nodeB, nodeC, multisigAddressBC);

        const appInstanceId = await installTTTAppVirtual(nodeA, nodeB, nodeC);

        const expectedNewState = {
          board: [[One, Zero, Zero], [Zero, Zero, Zero], [Zero, Zero, Zero]],
          versionNumber: One,
          winner: Zero
        };

        nodeC.once(
          NODE_EVENTS.UPDATE_STATE,
          async ({
            data: { newState, appInstanceId: retAppInstanceId }
          }: UpdateStateMessage) => {
            /**
             * TEST #1
             * The event emitted by Node C after an action is taken by A
             * sends the appInstanceId and the newState correctly.
             */
            expect(retAppInstanceId).toEqual(appInstanceId);
            expect(newState).toEqual(expectedNewState);

            const req = generateGetStateRequest(appInstanceId);

            /**
             * TEST #3
             * The database of Node C is correctly updated and querying it works
             */
            const {
              result: {
                result: { state: nodeCState }
              }
            } = (await nodeC.rpcRouter.dispatch(req)) as JsonRpcResponse;

            expect(nodeCState).toEqual(expectedNewState);

            /**
             * TEST #4
             * The database of Node A is correctly updated and querying it works
             */
            const {
              result: {
                result: { state: nodeAState }
              }
            } = (await nodeA.rpcRouter.dispatch(req)) as JsonRpcResponse;

            expect(nodeAState).toEqual(expectedNewState);

            done();
          }
        );

        const takeActionReq = generateTakeActionRequest(
          appInstanceId,
          validAction
        );

        /**
         * TEST #2
         * The return value from the call to Node A includes the new state
         */
        const { newState } = ((await nodeA.rpcRouter.dispatch(
          takeActionReq
        )) as JsonRpcResponse).result.result as NodeTypes.TakeActionResult;

        expect(newState).toEqual(expectedNewState);
      });
    }
  );
});

import {
  Address,
  AppABIEncodings,
  AssetType,
  Node as NodeTypes,
  SolidityABIEncoderV2Struct
} from "@counterfactual/types";
import { AddressZero, One, Zero } from "ethers/constants";
import { BaseProvider, JsonRpcProvider } from "ethers/providers";
import { bigNumberify } from "ethers/utils";
import { v4 as generateUUID } from "uuid";

import {
  IMessagingService,
  InstallMessage,
  IStoreService,
  Node,
  NODE_EVENTS,
  NodeConfig,
  ProposeMessage,
  UpdateStateMessage
} from "../../src";
import { ERRORS } from "../../src/methods/errors";

import TestFirebaseServiceFactory from "./services/firebase-service";
import {
  EMPTY_NETWORK,
  generateGetStateRequest,
  generateTakeActionRequest,
  getNewMultisig,
  makeInstallRequest
} from "./utils";

describe("Node method follows spec - takeAction", () => {
  jest.setTimeout(20000);

  let firebaseServiceFactory: TestFirebaseServiceFactory;
  let messagingService: IMessagingService;
  let nodeA: Node;
  let storeServiceA: IStoreService;
  let nodeB: Node;
  let storeServiceB: IStoreService;
  let nodeConfig: NodeConfig;
  let provider: BaseProvider;

  beforeAll(async () => {
    firebaseServiceFactory = new TestFirebaseServiceFactory(
      process.env.FIREBASE_DEV_SERVER_HOST!,
      process.env.FIREBASE_DEV_SERVER_PORT!
    );
    messagingService = firebaseServiceFactory.createMessagingService(
      process.env.FIREBASE_MESSAGING_SERVER_KEY!
    );
    nodeConfig = {
      STORE_KEY_PREFIX: process.env.FIREBASE_STORE_PREFIX_KEY!
    };

    const url = `http://localhost:${process.env.GANACHE_PORT}`;
    provider = new JsonRpcProvider(url);
  });

  beforeEach(async () => {
    storeServiceA = firebaseServiceFactory.createStoreService(
      process.env.FIREBASE_STORE_SERVER_KEY! + generateUUID()
    );
    nodeA = await Node.create(
      messagingService,
      storeServiceA,
      EMPTY_NETWORK,
      nodeConfig,
      provider
    );

    storeServiceB = firebaseServiceFactory.createStoreService(
      process.env.FIREBASE_STORE_SERVER_KEY! + generateUUID()
    );
    nodeB = await Node.create(
      messagingService,
      storeServiceB,
      EMPTY_NETWORK,
      nodeConfig,
      provider
    );
  });

  afterAll(async () => {
    await firebaseServiceFactory.closeServiceConnections();
  });

  describe(
    "Node A and B install an AppInstance, Node A takes action, " +
      "Node B confirms receipt of state update",
    () => {
      const stateEncoding =
        "tuple(address[2] players, uint256 turnNum, uint256 winner, uint256[3][3] board)";
      const actionEncoding =
        "tuple(uint8 actionType, uint256 playX, uint256 playY, tuple(uint8 winClaimType, uint256 idx) winClaim)";

      const initialState = {
        players: [AddressZero, AddressZero],
        turnNum: 0,
        winner: 0,
        board: [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
      };

      it("sends takeAction with invalid appInstanceId", async () => {
        const takeActionReq = generateTakeActionRequest("", {
          foo: "bar"
        });

        expect(nodeA.call(takeActionReq.type, takeActionReq)).rejects.toEqual(
          ERRORS.NO_APP_INSTANCE_FOR_TAKE_ACTION
        );
      });

      it("can take action", async done => {
        const validAction = {
          actionType: 0,
          playX: 0,
          playY: 0,
          winClaim: {
            winClaimType: 0,
            idx: 0
          }
        };

        const multisigAddress = await getNewMultisig(nodeA, [
          nodeA.publicIdentifier,
          nodeB.publicIdentifier
        ]);
        expect(multisigAddress).toBeDefined();

        const tttAppInstanceProposalReq = makeTTTAppInstanceProposalReq(
          nodeB.publicIdentifier,
          // @ts-ignore
          global.networkContext.TicTacToeAddress,
          initialState,
          {
            stateEncoding,
            actionEncoding
          }
        );

        let newState;
        nodeB.on(NODE_EVENTS.UPDATE_STATE, async (msg: UpdateStateMessage) => {
          const getStateReq = generateGetStateRequest(msg.data.appInstanceId);
          const response = await nodeB.call(getStateReq.type, getStateReq);
          const updatedState = (response.result as NodeTypes.GetStateResult)
            .state;
          expect(updatedState).toEqual(newState);
          done();
        });

        nodeA.on(NODE_EVENTS.INSTALL, async (msg: InstallMessage) => {
          const takeActionReq = generateTakeActionRequest(
            msg.data.params.appInstanceId,
            validAction
          );

          const response = await nodeA.call(takeActionReq.type, takeActionReq);
          newState = (response.result as NodeTypes.TakeActionResult).newState;

          expect(newState.board[0][0]).toEqual(bigNumberify(1));
          expect(newState.turnNum).toEqual(bigNumberify(1));
        });

        nodeB.on(NODE_EVENTS.PROPOSE_INSTALL, (msg: ProposeMessage) => {
          const installReq = makeInstallRequest(msg.data.appInstanceId);
          nodeB.emit(installReq.type, installReq);
        });

        nodeA.emit(tttAppInstanceProposalReq.type, tttAppInstanceProposalReq);
      });
    }
  );
});

function makeTTTAppInstanceProposalReq(
  proposedToIdentifier: string,
  appId: Address,
  initialState: SolidityABIEncoderV2Struct,
  abiEncodings: AppABIEncodings
): NodeTypes.MethodRequest {
  return {
    params: {
      proposedToIdentifier,
      appId,
      initialState,
      abiEncodings,
      asset: {
        assetType: AssetType.ETH
      },
      myDeposit: Zero,
      peerDeposit: Zero,
      timeout: One
    } as NodeTypes.ProposeInstallParams,
    requestId: generateUUID(),
    type: NodeTypes.MethodName.PROPOSE_INSTALL
  } as NodeTypes.MethodRequest;
}

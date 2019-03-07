import { Node as NodeTypes } from "@counterfactual/types";
import { JsonRpcProvider } from "ethers/providers";
import { v4 as generateUUID } from "uuid";

import { IMessagingService, IStoreService, Node, NodeConfig } from "../../src";
import { MNEMONIC_PATH } from "../../src/signer";
import {
  NODE_EVENTS,
  ProposeMessage,
  RejectProposalMessage
} from "../../src/types";
import { LocalFirebaseServiceFactory } from "../services/firebase-server";

import {
  confirmProposedAppInstanceOnNode,
  getInstalledAppInstances,
  getMultisigCreationTransactionHash,
  getProposedAppInstanceInfo,
  getProposedAppInstances,
  makeInstallProposalRequest,
  makeRejectInstallRequest
} from "./utils";

describe("Node method follows spec - rejectInstall", () => {
  jest.setTimeout(10000);

  let firebaseServiceFactory: LocalFirebaseServiceFactory;
  let messagingService: IMessagingService;
  let nodeA: Node;
  let storeServiceA: IStoreService;
  let nodeB: Node;
  let storeServiceB: IStoreService;
  let nodeConfig: NodeConfig;
  let provider: JsonRpcProvider;

  beforeAll(async () => {
    firebaseServiceFactory = new LocalFirebaseServiceFactory(
      process.env.FIREBASE_DEV_SERVER_HOST!,
      process.env.FIREBASE_DEV_SERVER_PORT!
    );
    messagingService = firebaseServiceFactory.createMessagingService(
      process.env.FIREBASE_MESSAGING_SERVER_KEY!
    );
    nodeConfig = {
      STORE_KEY_PREFIX: process.env.FIREBASE_STORE_PREFIX_KEY!
    };

    provider = new JsonRpcProvider(global["ganacheURL"]);

    storeServiceA = firebaseServiceFactory.createStoreService(
      process.env.FIREBASE_STORE_SERVER_KEY! + generateUUID()
    );
    storeServiceA.set([{ key: MNEMONIC_PATH, value: process.env.A_MNEMONIC }]);
    nodeA = await Node.create(
      messagingService,
      storeServiceA,
      nodeConfig,
      provider,
      global["networkContext"]
    );

    storeServiceB = firebaseServiceFactory.createStoreService(
      process.env.FIREBASE_STORE_SERVER_KEY! + generateUUID()
    );
    nodeB = await Node.create(
      messagingService,
      storeServiceB,
      nodeConfig,
      provider,
      global["networkContext"]
    );
  });

  afterAll(() => {
    firebaseServiceFactory.closeServiceConnections();
  });

  describe(
    "Node A gets app install proposal, sends to node B, B approves it, installs it," +
      "sends acks back to A, A installs it, both nodes have the same app instance",
    () => {
      it("sends proposal with non-null initial state", async done => {
        nodeA.on(
          NODE_EVENTS.CREATE_CHANNEL,
          async (data: NodeTypes.CreateChannelResult) => {
            expect(await getInstalledAppInstances(nodeA)).toEqual([]);
            expect(await getInstalledAppInstances(nodeB)).toEqual([]);

            let appInstanceId;

            // second, an app instance must be proposed to be installed into that channel
            const appInstanceInstallationProposalRequest = makeInstallProposalRequest(
              nodeB.publicIdentifier
            );

            nodeA.on(
              NODE_EVENTS.REJECT_INSTALL,
              async (msg: RejectProposalMessage) => {
                expect((await getProposedAppInstances(nodeA)).length).toEqual(
                  0
                );
                done();
              }
            );

            // node B then decides to reject the proposal
            nodeB.on(
              NODE_EVENTS.PROPOSE_INSTALL,
              async (msg: ProposeMessage) => {
                confirmProposedAppInstanceOnNode(
                  appInstanceInstallationProposalRequest.params,
                  await getProposedAppInstanceInfo(nodeA, appInstanceId)
                );

                const rejectReq = makeRejectInstallRequest(
                  msg.data.appInstanceId
                );

                // Node A should have a proposal in place before Node B rejects it
                expect((await getProposedAppInstances(nodeA)).length).toEqual(
                  1
                );

                await nodeB.call(rejectReq.type, rejectReq);

                expect((await getProposedAppInstances(nodeB)).length).toEqual(
                  0
                );
              }
            );

            const response = await nodeA.call(
              appInstanceInstallationProposalRequest.type,
              appInstanceInstallationProposalRequest
            );
            appInstanceId = (response.result as NodeTypes.ProposeInstallResult)
              .appInstanceId;
          }
        );
        await getMultisigCreationTransactionHash(nodeA, [
          nodeA.publicIdentifier,
          nodeB.publicIdentifier
        ]);
      });
    }
  );
});

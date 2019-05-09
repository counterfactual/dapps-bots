import { CreateChannelMessage, Node, NODE_EVENTS } from "../../src";
import { LocalFirebaseServiceFactory } from "../services/firebase-server";

import { setup } from "./setup";
import {
  confirmChannelCreation,
  getChannelAddresses,
  getMultisigCreationTransactionHash
} from "./utils";

describe("Node can create multisig, other owners get notified", () => {
  let firebaseServiceFactory: LocalFirebaseServiceFactory;
  let nodeA: Node;
  let nodeB: Node;
  let nodeC: Node;

  beforeAll(async () => {
    const result = await setup(global, true);
    nodeA = result.nodeA;
    nodeB = result.nodeB;
    nodeC = result.nodeC!;
    firebaseServiceFactory = result.firebaseServiceFactory;
  });

  afterAll(() => {
    firebaseServiceFactory.closeServiceConnections();
  });

  describe("Queued channel creation", () => {
    it("Node A can create multiple back-to-back channels with Node B and Node C", async done => {
      const ownersABPublicIdentifiers = [
        nodeA.publicIdentifier,
        nodeB.publicIdentifier
      ];

      const ownersACPublicIdentifiers = [
        nodeA.publicIdentifier,
        nodeC.publicIdentifier
      ];

      nodeA.on(
        NODE_EVENTS.CREATE_CHANNEL,
        async (msg: CreateChannelMessage) => {
          if (msg.data.owners === ownersABPublicIdentifiers) {
            const openChannelsNodeA = await getChannelAddresses(nodeA);
            const openChannelsNodeB = await getChannelAddresses(nodeB);
            expect(openChannelsNodeA.size).toEqual(1);
            expect(openChannelsNodeB.size).toEqual(1);

            await confirmChannelCreation(
              nodeA,
              nodeB,
              ownersABPublicIdentifiers,
              msg.data
            );
          } else {
            const openChannelsNodeA = await getChannelAddresses(nodeA);
            const openChannelsNodeC = await getChannelAddresses(nodeC);

            expect(openChannelsNodeA.size).toEqual(2);
            expect(openChannelsNodeC.size).toEqual(1);

            await confirmChannelCreation(
              nodeA,
              nodeC,
              ownersACPublicIdentifiers,
              msg.data
            );

            done();
          }
        }
      );

      const txHash1 = await getMultisigCreationTransactionHash(
        nodeA,
        ownersABPublicIdentifiers
      );

      const txHash2 = await getMultisigCreationTransactionHash(
        nodeA,
        ownersACPublicIdentifiers
      );

      expect(txHash1).toBeDefined();
      expect(txHash2).toBeDefined();
    });
  });
});

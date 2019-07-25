import { Node as NodeTypes } from "@counterfactual/types";

import { Node } from "../../src";
import { NODE_EVENTS, ProposeVirtualMessage } from "../../src/types";

import { setup, SetupContext } from "./setup";
import {
  collateralizeChannel,
  confirmProposedVirtualAppInstanceOnNode as confirmProposedVirtualAppInstance,
  createChannel,
  getInstalledAppInstances,
  getProposedAppInstances,
  installTTTVirtual,
  makeTTTVirtualProposal
} from "./utils";

describe("Node method follows spec - proposeInstallVirtual", () => {
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
    "Node A makes a proposal through an intermediary Node B to install a " +
      "Virtual AppInstance with Node C. All Nodes confirm receipt of proposal",
    () => {
      it("sends proposal with non-null initial state", async done => {
        const multisigAddressAB = await createChannel(nodeA, nodeB);
        const multisigAddressBC = await createChannel(nodeB, nodeC);

        await collateralizeChannel(nodeA, nodeB, multisigAddressAB);
        await collateralizeChannel(nodeB, nodeC, multisigAddressBC);

        let proposalParams: NodeTypes.ProposeInstallVirtualParams;
        nodeA.once(NODE_EVENTS.INSTALL_VIRTUAL, async () => {
          const [virtualAppNodeA] = await getInstalledAppInstances(nodeA);

          const [virtualAppNodeC] = await getInstalledAppInstances(nodeC);

          expect(virtualAppNodeA).toEqual(virtualAppNodeC);

          done();
        });

        nodeC.once(
          NODE_EVENTS.PROPOSE_INSTALL_VIRTUAL,
          async (msg: ProposeVirtualMessage) => {
            const { appInstanceId } = msg.data;
            const { intermediaries } = msg.data.params;
            const [proposedAppNodeA] = await getProposedAppInstances(nodeA);
            const [proposedAppNodeC] = await getProposedAppInstances(nodeC);

            confirmProposedVirtualAppInstance(proposalParams, proposedAppNodeA);
            confirmProposedVirtualAppInstance(
              proposalParams,
              proposedAppNodeC,
              true
            );

            expect(proposedAppNodeC.proposedByIdentifier).toEqual(
              nodeA.publicIdentifier
            );
            expect(proposedAppNodeA.identityHash).toEqual(
              proposedAppNodeC.identityHash
            );
            installTTTVirtual(nodeC, appInstanceId, intermediaries);
          }
        );

        const result = await makeTTTVirtualProposal(nodeA, nodeC, nodeB);
        proposalParams = result.params as NodeTypes.ProposeInstallVirtualParams;
      });
    }
  );
});

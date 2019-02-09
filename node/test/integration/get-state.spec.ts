import { Node as NodeTypes } from "@counterfactual/types";
import { BaseProvider, JsonRpcProvider } from "ethers/providers";
import { v4 as generateUUID } from "uuid";

import { IMessagingService, IStoreService, Node, NodeConfig } from "../../src";
import { ERRORS } from "../../src/methods/errors";
import { MNEMONIC_PATH } from "../../src/signer";

import TestFirebaseServiceFactory from "./services/firebase-service";
import {
  generateGetStateRequest,
  getNewMultisig,
  makeInstallProposalRequest,
  TEST_NETWORK
} from "./utils";

describe("Node method follows spec - getAppInstances", () => {
  jest.setTimeout(15000);

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

    // @ts-ignore
    provider = new JsonRpcProvider(global.ganacheURL);

    storeServiceA = firebaseServiceFactory.createStoreService(
      process.env.FIREBASE_STORE_SERVER_KEY! + generateUUID()
    );
    storeServiceA.set([{ key: MNEMONIC_PATH, value: process.env.A_MNEMONIC }]);
    nodeA = await Node.create(
      messagingService,
      storeServiceA,
      nodeConfig,
      provider,
      TEST_NETWORK,
      // @ts-ignore
      global.networkContext
    );

    storeServiceB = firebaseServiceFactory.createStoreService(
      process.env.FIREBASE_STORE_SERVER_KEY! + generateUUID()
    );
    nodeB = await Node.create(
      messagingService,
      storeServiceB,
      nodeConfig,
      provider,
      TEST_NETWORK,
      // @ts-ignore
      global.networkContext
    );
  });

  afterAll(() => {
    firebaseServiceFactory.closeServiceConnections();
  });

  it("returns the right response for getting the state of a non-existent AppInstance", async () => {
    const getStateReq = generateGetStateRequest(generateUUID());
    expect(
      nodeA.call(NodeTypes.MethodName.GET_STATE, getStateReq)
    ).rejects.toEqual(ERRORS.NO_MULTISIG_FOR_APP_INSTANCE_ID);
  });

  it("returns the right state for an installed AppInstance", async () => {
    const multisigAddress = await getNewMultisig(nodeA, [
      nodeA.publicIdentifier,
      nodeB.publicIdentifier
    ]);
    expect(multisigAddress).toBeDefined();

    const appInstanceInstallationProposalRequest = makeInstallProposalRequest(
      nodeB.publicIdentifier
    );

    const proposalResult = await nodeA.call(
      appInstanceInstallationProposalRequest.type,
      appInstanceInstallationProposalRequest
    );
    const appInstanceId = (proposalResult.result as NodeTypes.ProposeInstallResult)
      .appInstanceId;

    const installAppInstanceRequest: NodeTypes.MethodRequest = {
      requestId: generateUUID(),
      type: NodeTypes.MethodName.INSTALL,
      params: {
        appInstanceId
      } as NodeTypes.InstallParams
    };

    await nodeA.call(installAppInstanceRequest.type, installAppInstanceRequest);

    const getStateReq = generateGetStateRequest(appInstanceId);

    const getStateResult = await nodeA.call(getStateReq.type, getStateReq);
    const state = (getStateResult.result as NodeTypes.GetStateResult).state;
    expect(state.foo).toEqual(
      (appInstanceInstallationProposalRequest.params as NodeTypes.ProposeInstallParams)
        .initialState.foo
    );
    expect(state.bar).toEqual(
      (appInstanceInstallationProposalRequest.params as NodeTypes.ProposeInstallParams)
        .initialState.bar
    );
  });
});

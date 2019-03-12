import {
  DepositConfirmationMessage,
  FirebaseServiceFactory,
  IMessagingService,
  IStoreService,
  MNEMONIC_PATH,
  Node
} from "@counterfactual/node";
import { NetworkContext, Node as NodeTypes } from "@counterfactual/types";
import { JsonRpcProvider } from "ethers/providers";
import FirebaseServer from "firebase-server";
import { Log } from "logepi";
import { v4 as generateUUID } from "uuid";

import { bindMultisigToUser } from "./db";

export class LocalFirebaseServiceFactory extends FirebaseServiceFactory {
  firebaseServer: FirebaseServer;
  constructor(private readonly host: string, private readonly port: string) {
    super({
      databaseURL: `ws://${host}:${port}`,
      projectId: "something",
      apiKey: "",
      authDomain: "",
      storageBucket: "",
      messagingSenderId: ""
    });

    this.firebaseServer = new FirebaseServer(this.port, this.host);
  }

  async closeServiceConnections() {
    await this.firebaseServer.close();
  }
}

export let serviceFactory: FirebaseServiceFactory;
if (process.env.FIREBASE_SERVER_HOST && process.env.FIREBASE_SERVER_PORT) {
  serviceFactory = new LocalFirebaseServiceFactory(
    process.env.FIREBASE_SERVER_HOST,
    process.env.FIREBASE_SERVER_PORT
  );
} else {
  serviceFactory = new FirebaseServiceFactory({
    apiKey: "AIzaSyA5fy_WIAw9mqm59mdN61CiaCSKg8yd4uw",
    authDomain: "foobar-91a31.firebaseapp.com",
    databaseURL: "https://foobar-91a31.firebaseio.com",
    projectId: "foobar-91a31",
    storageBucket: "foobar-91a31.appspot.com",
    messagingSenderId: "432199632441"
  });
}

export default class NodeWrapper {
  private static node: Node;
  public static depositRetryCount = 0;

  public static depositsMade: Map<string, boolean>;
  public static getInstance() {
    if (!NodeWrapper.node) {
      throw new Error(
        "Node hasn't been instantiated yet. Call NodeWrapper.createNode() first."
      );
    }

    return NodeWrapper.node;
  }

  public static getNodeAddress() {
    if (!NodeWrapper.node) {
      throw new Error(
        "Node hasn't been instantiated yet. Call NodeWrapper.createNode() first."
      );
    }

    return NodeWrapper.node.publicIdentifier;
  }

  public static async createNodeSingleton(
    networkOrNetworkContext: string | NetworkContext,
    mnemonic?: string,
    provider?: JsonRpcProvider,
    storeService?: IStoreService,
    messagingService?: IMessagingService
  ): Promise<Node> {
    if (NodeWrapper.node) {
      return NodeWrapper.node;
    }

    const store =
      storeService ||
      serviceFactory.createStoreService(
        `${process.env.STORE_PREFIX}-pg-server-store`
      );

    NodeWrapper.node = await NodeWrapper.createNode(
      networkOrNetworkContext,
      provider,
      mnemonic,
      store,
      messagingService
    );

    NodeWrapper.node.on(
      NodeTypes.EventName.DEPOSIT_CONFIRMED,
      onDepositConfirmed.bind(this)
    );

    NodeWrapper.node.on(
      NodeTypes.EventName.CREATE_CHANNEL,
      onMultisigDeployed.bind(this)
    );

    Log.info("Node singleton instance ready", {
      tags: { ethAddress: NodeWrapper.node["signer"]["address"] }
    });

    return NodeWrapper.node;
  }

  public static async createNode(
    networkOrNetworkContext: string | NetworkContext,
    provider?: JsonRpcProvider,
    mnemonic?: string,
    storeService?: IStoreService,
    messagingService?: IMessagingService
  ): Promise<Node> {
    const store =
      storeService || serviceFactory.createStoreService(generateUUID());

    const messaging =
      messagingService || serviceFactory.createMessagingService("messaging");

    if (mnemonic) {
      await store.set([{ key: MNEMONIC_PATH, value: mnemonic }]);
    }

    if (!provider && typeof networkOrNetworkContext !== "string") {
      throw Error("cannot pass empty provider without network");
    }

    const node = await Node.create(
      messaging,
      store,
      {
        STORE_KEY_PREFIX: "store"
      },
      provider ||
        new JsonRpcProvider(
          `https://${networkOrNetworkContext}.infura.io/metamask`
        ),
      networkOrNetworkContext
    );

    return node;
  }

  public static async createStateChannelFor(
    nodeAddress: string
  ): Promise<NodeTypes.CreateChannelTransactionResult> {
    if (!NodeWrapper.node) {
      throw new Error(
        "Node hasn't been instantiated yet. Call NodeWrapper.createNode() first."
      );
    }

    const { node } = NodeWrapper;

    const multisigResponse = await node.call(
      NodeTypes.MethodName.CREATE_CHANNEL,
      {
        params: {
          owners: [node.publicIdentifier, nodeAddress]
        } as NodeTypes.CreateChannelParams,
        type: NodeTypes.MethodName.CREATE_CHANNEL,
        requestId: generateUUID()
      }
    );

    return multisigResponse.result as NodeTypes.CreateChannelTransactionResult;
  }
}

export async function onDepositConfirmed(response: DepositConfirmationMessage) {
  if (response === undefined) {
    return;
  }

  try {
    await NodeWrapper.getInstance().call(NodeTypes.MethodName.DEPOSIT, {
      requestId: generateUUID(),
      type: NodeTypes.MethodName.DEPOSIT,
      params: response.data as NodeTypes.DepositParams
    });
  } catch (e) {
    Log.error("Failed to deposit on the server", {
      tags: { reason: e.message, stackTrace: e.stack }
    });
  }
}

export async function onMultisigDeployed(
  result: NodeTypes.CreateChannelResult
) {
  await bindMultisigToUser(
    result.counterpartyXpub, // FIXME: Not standard data flow
    result.multisigAddress
  );
}

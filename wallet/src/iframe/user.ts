import * as ethers from "ethers";
import * as machine from "@counterfactual/machine";

import { CommitmentStore } from "../commitmentStore";
import { IframeIoProvider } from "./ioProvider";
import { IframeWallet } from "./wallet";

export let ganacheURL;

try {
  ganacheURL = process.env.GANACHE_URL || "http://localhost:9545";
  console.info(`Using the specified blockchain URL: ${ganacheURL}`);
} catch (e) {
  ganacheURL = "http://localhost:9545";
  console.info(`No blockchain URL specified. Defaulting to ${ganacheURL}`);
}

export class User
  implements machine.mixins.Observable, machine.types.ResponseSink {
  get isCurrentUser(): boolean {
    return this.wallet.currentUser === this;
  }
  public signingKey: ethers.utils.SigningKey;
  public ethersWallet: ethers.Wallet | ethers.providers.JsonRpcSigner;
  public vm: machine.vm.CounterfactualVM;
  public io: IframeIoProvider;
  public address: string;
  public store: CommitmentStore;

  /**
   * The write ahead log is used to keep track of protocol executions.
   * Specifically, whenever an instruction in a protocol is executed,
   * we write to the log so that, if the machine crashes, we can resume
   * by reading the last log entry and starting where the protocol left off.
   */
  public wal: machine.wal.CfVmWal;

  // Observable
  public observers: Map<
    machine.mixins.NotificationType,
    Function[]
  > = new Map();
  private observerCallbacks: Map<string, Function> = new Map<
    string,
    Function
  >();

  constructor(
    readonly wallet: IframeWallet,
    address: string,
    privateKey: string,
    networkContext: machine.types.NetworkContext,
    db?: machine.wal.SyncDb,
    states?: machine.types.ChannelStates
  ) {
    this.wallet = wallet;
    this.address = address;
    this.io = new IframeIoProvider(this);
    this.vm = new machine.vm.CounterfactualVM(
      new machine.vm.CfVmConfig(
        this,
        new machine.cfOperations.EthCfOpGenerator(),
        networkContext,
        states
      )
    );
    this.wal = new machine.wal.CfVmWal(
      db !== undefined ? db : new machine.wal.MemDb(),
      this.address
    );
    this.store = new CommitmentStore();
    this.io.ackMethod = this.vm.startAck.bind(this.vm);
    this.registerMiddlewares();
    this.vm.registerObserver(
      "actionCompleted",
      this.handleActionCompletion.bind(this)
    );

    this.signingKey = new ethers.utils.SigningKey(privateKey);
    this.address = this.signingKey.address;
    const { web3 } = window as any;
    if (web3) {
      console.info("using web3");
      this.ethersWallet = new ethers.providers.Web3Provider(
        web3.currentProvider
      ).getSigner();
    } else {
      console.info("using json rpc provider");
      this.ethersWallet = new ethers.Wallet(
        privateKey,
        new ethers.providers.JsonRpcProvider(ganacheURL)
      );
      console.log(this.ethersWallet);
    }
  }
  public registerObserver(
    type: machine.mixins.NotificationType,
    callback: Function
  ) {}
  public unregisterObserver(
    type: machine.mixins.NotificationType,
    callback: Function
  ) {}
  public notifyObservers(type: machine.mixins.NotificationType, data: object) {}

  public async deposit(options) {
    await this.ethersWallet.sendTransaction({
      to: options.multisig,
      value: options.value
    });
  }

  // Load the previously saved data if any, and continue executing protocols
  public async init() {
    const savedLog = this.wal.readLog();
    if (Object.keys(savedLog).length === 0) {
      console.info("WAL is empty. Starting machine from clean state.");
    } else {
      console.info("WAL is not empty. Starting machine from persisted state.");
    }

    await this.vm.resume(savedLog);
  }

  public handleActionCompletion(notification: machine.types.Notification) {
    this.notifyObservers(`${notification.data.name}Completed`, {
      requestId: notification.data.requestId,
      result: this.generateObserverNotification(notification),
      clientMessage: notification.data.clientMessage
    });
  }

  public generateObserverNotification(
    notification: machine.types.Notification
  ): any {
    return notification.data.results.find(result => result.opCode === 0).value;
  }

  public addObserver(message: machine.types.ClientActionMessage) {
    const boundNotification = this.sendNotification.bind(
      this,
      message.data.notificationType
    );
    this.observerCallbacks.set(message.data.observerId, boundNotification);
    this.registerObserver(message.data.notificationType, boundNotification);
  }

  public removeObserver(message: machine.types.ClientActionMessage) {
    const callback = this.observerCallbacks.get(message.data.observerId);

    if (callback) {
      this.unregisterObserver(message.data.notificationType, callback);
    }
  }

  public sendNotification(
    type: machine.mixins.NotificationType,
    message: object
  ) {
    if (this.isCurrentUser) {
      this.wallet.sendNotification(type, message);
    }
  }

  public sendResponse(
    res: machine.types.WalletResponse | machine.types.Notification
  ) {
    if (this.isCurrentUser) {
      this.wallet.sendResponse(res);
    }
  }

  public sendIoMessageToClient(message: any) {
    if (this.isCurrentUser) {
      this.wallet.sendIoMessageToClient(message);
    }
  }

  private registerMiddlewares() {
    this.vm.register(
      machine.instructions.Instruction.ALL,
      async (
        message: machine.types.InternalMessage,
        next: Function,
        context: machine.state.Context
      ) => {
        this.wal.write(message, context);
      }
    );

    this.vm.register(
      machine.instructions.Instruction.OP_SIGN,
      async (
        message: machine.types.InternalMessage,
        next: Function,
        context: machine.state.Context
      ) => {
        return signMyUpdate(message, next, context, this);
      }
    );
    this.vm.register(
      machine.instructions.Instruction.OP_SIGN_VALIDATE,
      async (
        message: machine.types.InternalMessage,
        next: Function,
        context: machine.state.Context
      ) => {
        return validateSignatures(message, next, context, this);
      }
    );
    this.vm.register(
      machine.instructions.Instruction.IO_SEND,
      this.io.ioSendMessage.bind(this.io)
    );
    this.vm.register(
      machine.instructions.Instruction.IO_WAIT,
      this.io.waitForIo.bind(this.io)
    );
    this.vm.register(
      machine.instructions.Instruction.STATE_TRANSITION_COMMIT,
      this.store.setCommitment.bind(this.store)
    );
  }
}

/**
 * Plugin middleware methods.
 */

async function signMyUpdate(
  message: machine.types.InternalMessage,
  next: Function,
  context: machine.state.Context,
  user: User
): Promise<machine.types.Signature> {
  const operation: machine.cfTypes.CfOperation = machine.middleware.getFirstResult(
    machine.instructions.Instruction.OP_GENERATE,
    context.results
  ).value;
  const digest = operation.hashToSign();
  const sig = user.signingKey.signDigest(digest);
  console.debug(
    `🔑  Signing ${message.actionName} message: ${digest.substr(0, 16)}...`
  );
  return new machine.types.Signature(sig.recoveryParam! + 27, sig.r, sig.s);
}

async function validateSignatures(
  message: machine.types.InternalMessage,
  next: Function,
  context: machine.state.Context,
  user: User
) {
  const op: machine.cfTypes.CfOperation = machine.middleware.getLastResult(
    machine.instructions.Instruction.OP_GENERATE,
    context.results
  ).value;
  const digest = op.hashToSign();
  let sig;
  const expectedSigningAddress =
    message.clientMessage.toAddress === user.address
      ? message.clientMessage.fromAddress
      : message.clientMessage.toAddress;
  if (message.clientMessage.signature === undefined) {
    // initiator
    const incomingMessage = machine.middleware.getLastResult(
      machine.instructions.Instruction.IO_WAIT,
      context.results
    ).value;
    sig = incomingMessage.signature;
  } else {
    // receiver
    sig = message.clientMessage.signature;
  }

  const recoveredAddress = ethers.utils.recoverAddress(digest, {
    v: sig.v,
    r: sig.r,
    s: sig.s
  });
  if (recoveredAddress !== expectedSigningAddress) {
    // FIXME: handle this more gracefully
    throw Error("Invalid signature");
  }
}

machine.mixins.applyMixins(User, [machine.mixins.Observable]);

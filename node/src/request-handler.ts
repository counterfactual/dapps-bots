import {
  Context,
  InstructionExecutor,
  Opcode,
  Protocol,
  ProtocolMessage
} from "@counterfactual/machine";
import { SetupParams } from "@counterfactual/machine/dist/src/protocol-types-tbd";
import { Address, NetworkContext, Node } from "@counterfactual/types";
import EventEmitter from "eventemitter3";

import {
  eventNameToImplementation,
  methodNameToImplementation
} from "./api-router";
import { IMessagingService, IStoreService } from "./services";
import { Store } from "./store";
import { NODE_EVENTS, NodeEvents, NodeMessage } from "./types";

/**
 * This class registers handlers for requests to get or set some information
 * about app instances and channels for this Node and any relevant peer Nodes.
 */
export class RequestHandler {
  private methods = new Map();
  private events = new Map();
  store: Store;
  constructor(
    readonly address: Address,
    readonly incoming: EventEmitter,
    readonly outgoing: EventEmitter,
    readonly storeService: IStoreService,
    readonly messagingService: IMessagingService,
    readonly instructionExecutor: InstructionExecutor,
    readonly networkContext: NetworkContext,
    storeKeyPrefix: string
  ) {
    this.store = new Store(storeService, storeKeyPrefix);
    this.mapPublicApiMethods();
    this.mapEventHandlers();
    this.startStoringCommitments();
  }

  /**
   * In some use cases, waiting for the response of a method call is easier
   * and cleaner than wrangling through callback hell.
   * @param method
   * @param req
   */
  public async callMethod(
    method: Node.MethodName,
    req: Node.MethodRequest
  ): Promise<Node.MethodResponse> {
    return {
      type: req.type,
      requestId: req.requestId,
      result: await this.methods.get(method)(this, req.params)
    };
  }

  /**
   * This registers all of the methods the Node is expected to have
   * as described at https://github.com/counterfactual/monorepo/blob/master/packages/cf.js/API_REFERENCE.md#public-methods
   */
  private mapPublicApiMethods() {
    for (const methodName in methodNameToImplementation) {
      this.methods.set(methodName, methodNameToImplementation[methodName]);

      this.incoming.on(methodName, async (req: Node.MethodRequest) => {
        const res: Node.MethodResponse = {
          type: req.type,
          requestId: req.requestId,
          result: await this.methods.get(methodName)(this, req.params)
        };
        this.outgoing.emit(req.type, res);
      });
    }
  }

  /**
   * This maps the Node event names to their respective handlers.
   *
   * These are the events being listened on to detect requests from peer Nodes.
   * https://github.com/counterfactual/monorepo/blob/master/packages/cf.js/API_REFERENCE.md#events
   */
  private mapEventHandlers() {
    for (const eventName of Object.values(NODE_EVENTS)) {
      this.events.set(eventName, eventNameToImplementation[eventName]);
    }
  }

  /**
   * This is internally called when an event is received from a peer Node.
   * Node consumers can separately setup their own callbacks for incoming events.
   * @param event
   * @param msg
   */
  public async callEvent(event: NodeEvents, msg: NodeMessage) {
    await this.events.get(event)(this, msg);
  }

  private startStoringCommitments() {
    this.instructionExecutor.register(
      Opcode.STATE_TRANSITION_COMMIT,
      async (message: ProtocolMessage, next: Function, context: Context) => {
        if (!context.commitment) {
          throw new Error(
            `State transition without commitment: ${JSON.stringify(message)}`
          );
        }
        const transaction = context.commitment!.transaction([
          context.signature! // TODO: add counterparty signature
        ]);
        const { protocol } = message;
        if (protocol === Protocol.Setup) {
          const params = message.params as SetupParams;
          await this.store.setSetupCommitmentForMultisig(
            params.multisigAddress,
            transaction
          );
        } else {
          if (!context.appIdentityHash) {
            throw new Error(
              `appIdentityHash required to store commitment. protocol=${protocol}`
            );
          }
          await this.store.setCommitmentForAppIdentityHash(
            context.appIdentityHash!,
            protocol,
            transaction
          );
        }
        next();
      }
    );
  }
}

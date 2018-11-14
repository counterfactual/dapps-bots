import * as cf from "@counterfactual/cf.js";

import { Action, ActionExecution } from "./action";
import { Opcode } from "./instructions";
import { Middleware, OpGenerator } from "./middleware/middleware";
import { applyMixins } from "./mixins/apply";
import { NotificationType, Observable } from "./mixins/observable";
import { NodeState } from "./node-state";
import { InstructionMiddlewareCallback, OpCodeResult } from "./types";
import { Log } from "./write-ahead-log";

export class InstructionExecutorConfig {
  constructor(
    readonly responseHandler: cf.legacy.node.ResponseSink,
    readonly opGenerator: OpGenerator,
    readonly network: cf.legacy.network.NetworkContext,
    readonly state?: cf.legacy.channel.StateChannelInfos
  ) {}
}

export class InstructionExecutor implements Observable {
  /**
   * The object responsible for processing each Instruction in the Vm.
   */
  public middleware: Middleware;
  /**
   * The delegate handler we send responses to.
   */
  public responseHandler: cf.legacy.node.ResponseSink;
  /**
   * The underlying state for the entire machine. All state here is a result of
   * a completed and commited protocol.
   */
  public nodeState: NodeState;

  // Observable
  public observers: Map<NotificationType, Function[]> = new Map();

  constructor(config: InstructionExecutorConfig) {
    this.responseHandler = config.responseHandler;
    this.nodeState = new NodeState(config.state || {}, config.network);
    this.middleware = new Middleware(this.nodeState, config.opGenerator);
  }

  public registerObserver(type: NotificationType, callback: Function) {}
  public unregisterObserver(type: NotificationType, callback: Function) {}
  public notifyObservers(type: NotificationType, data: object) {}

  /**
   * Restarts all protocols that were stopped mid execution, and returns when
   * they all finish.
   */
  public async resume(log: Log) {
    const executions = this.buildExecutionsFromLog(log);
    return executions.reduce(
      (promise, exec) => promise.then(_ => this.run(exec)),
      Promise.resolve()
    );
  }

  /**
   * @returns all unfinished protocol executions read from the db.
   */
  public buildExecutionsFromLog(log: Log): ActionExecution[] {
    return Object.keys(log).map(key => {
      const entry = log[key];
      const action = new Action(
        entry.requestId,
        entry.actionName,
        entry.clientMessage,
        entry.isAckSide
      );
      const execution = new ActionExecution(
        action,
        entry.instructionPointer,
        entry.clientMessage,
        this
      );
      execution.results = entry.results;
      action.execution = execution;
      return execution;
    });
  }

  public startAck(message: cf.legacy.node.ClientActionMessage) {
    this.execute(new Action(message.requestId, message.action, message, true));
  }

  public receive(
    msg: cf.legacy.node.ClientActionMessage
  ): cf.legacy.node.WalletResponse {
    if (!this.validateMessage(msg)) {
      throw new Error("Cannot receive invalid message");
    }

    const action = new Action(msg.requestId, msg.action, msg);
    this.execute(action);

    return new cf.legacy.node.WalletResponse(
      action.requestId,
      cf.legacy.node.ResponseStatus.STARTED
    );
  }

  public validateMessage(msg: cf.legacy.node.ClientActionMessage) {
    // TODO;
    return true;
  }

  public async execute(action: Action) {
    const execution = action.makeExecution(this);
    await this.run(execution);

    this.notifyObservers("actionCompleted", {
      type: "notification",
      NotificationType: "actionCompleted",
      data: {
        requestId: action.requestId,
        name: action.name,
        results: execution.results,
        clientMessage: action.clientMessage
      }
    });
  }

  public async run(execution: ActionExecution) {
    try {
      // Temporary error handling for testing resuming protocols
      let val;
      // TODO: Bizarre syntax...
      // https://github.com/counterfactual/monorepo/issues/123
      for await (val of execution) {
      }
      this.sendResponse(execution, cf.legacy.node.ResponseStatus.COMPLETED);
    } catch (e) {
      console.error(e);
      this.sendResponse(execution, cf.legacy.node.ResponseStatus.ERROR);
    }
  }

  public sendResponse(
    execution: ActionExecution,
    status: cf.legacy.node.ResponseStatus
  ) {
    if (execution.action.isAckSide) {
      return;
    }

    this.responseHandler.sendResponse(
      new cf.legacy.node.Response(execution.action.requestId, status)
    );
  }

  public mutateState(state: cf.legacy.channel.StateChannelInfos) {
    Object.assign(this.nodeState.channelStates, state);
  }

  public register(scope: Opcode, method: InstructionMiddlewareCallback) {
    this.middleware.add(scope, method);
  }
}

export class Context {
  public results: OpCodeResult[] = Object.create(null);
  public instructionPointer: number = Object.create(null);
  public instructionExecutor: InstructionExecutor = Object.create(null);
}

applyMixins(InstructionExecutor, [Observable]);

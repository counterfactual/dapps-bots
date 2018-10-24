import { ethers } from "ethers";
import { Instruction, instructions } from "../../src/instructions";
import { EthCfOpGenerator } from "../../src/middleware/cf-operation/cf-op-generator";
import { StateTransition } from "../../src/middleware/state-transition/state-transition";
import { Context } from "../../src/state";
import {
  ActionName,
  ClientActionMessage,
  InternalMessage
} from "../../src/types";
import { ResponseStatus } from "../../src/vm";
import {
  SimpleStringMapSyncDB,
  WriteAheadLog
} from "../../src/write-ahead-log";
import {
  A_ADDRESS,
  A_PRIVATE_KEY,
  B_ADDRESS,
  B_PRIVATE_KEY,
  MULTISIG_ADDRESS
} from "../utils/environment";
import { TestResponseSink } from "./test-response-sink";

const ADDR_A = ethers.utils.hexlify(ethers.utils.randomBytes(20));
const ADDR_B = ethers.utils.hexlify(ethers.utils.randomBytes(20));

// FIXME: These tests throw Errors which, when running the tests, makes it look
// like they're failing because of the massive call stack that shows on the terminal.
// We should find a way to prevent the error from showing up even though the test passes.

/**
 * See run() for the entry point to the test. The basic structure
 * is for each test, we create a hook into the middleware at the
 * instructon we want to crash the machine at. Then we run the
 * protocol, have it crash at that instruction, restart the
 * machine by creating a brand new object (but with the same underlying)
 * db, and finally resume execution from where we crashed.
 */
abstract class SetupProtocolTestCase {
  /**
   * WAL db for peerA. This is the persistence we'll use to
   * recreate a new machine and resume protocols.
   */
  public db: SimpleStringMapSyncDB;
  public peerA: TestResponseSink;
  public peerB: TestResponseSink;
  public executedInstructions: Instruction[];

  constructor() {
    this.db = new SimpleStringMapSyncDB();
    this.peerA = new TestResponseSink(A_PRIVATE_KEY);
    this.peerA.writeAheadLog = new WriteAheadLog(this.db, ADDR_A);
    this.peerB = new TestResponseSink(B_PRIVATE_KEY);
    this.peerA.io.peer = this.peerB;
    this.peerB.io.peer = this.peerA;
    this.executedInstructions = [];
  }

  public async run() {
    await this.peerA.vm.resume(this.peerA.writeAheadLog.readLog());
    this.setupWallet(this.peerA, true);
    const resp = await this.peerA.runProtocol(this.msg());
    expect(resp.status).toEqual(ResponseStatus.ERROR);
    await this.resumeNewMachine();
    this.validate();
  }

  /**
   * Creates a new peer with the same underlyin WAL db,
   * and then resumes the protocols from where they left
   * off.
   */
  public async resumeNewMachine() {
    // make a new peer with the exact same state
    // i.e., the same WAL db and the same channelStates
    const peerARebooted = new TestResponseSink(A_PRIVATE_KEY);
    peerARebooted.writeAheadLog = new WriteAheadLog(this.db, ADDR_A);
    peerARebooted.io.peer = this.peerB;
    this.peerB.io.peer = peerARebooted;
    this.setupWallet(peerARebooted, false);
    await peerARebooted.vm.resume(peerARebooted.writeAheadLog.readLog());
  }

  public abstract setupWallet(peer: TestResponseSink, shouldError: boolean);
  /**
   * @returns the msg to start the setup protocol.
   */
  public abstract description(): string;
  public abstract validate();

  private msg(): ClientActionMessage {
    return {
      requestId: "0",
      appId: undefined,
      action: ActionName.SETUP,
      data: {},
      multisigAddress: MULTISIG_ADDRESS,
      toAddress: A_ADDRESS,
      fromAddress: B_ADDRESS,
      stateChannel: undefined,
      seq: 0
    };
  }
}

class ResumeFirstInstructionTest extends SetupProtocolTestCase {
  public description(): string {
    return "should resume a protocol from the beginning if it crashes during the first instruction";
  }

  public setupWallet(peer: TestResponseSink, shouldError: boolean) {
    // ensure the instructions are recorded so we can validate the test
    peer.vm.register(
      Instruction.ALL,
      async (message: InternalMessage, next: Function, context: Context) => {
        this.executedInstructions.push(message.opCode);
      }
    );

    // override the existing STATE_TRANSITION_PROPOSE middleware so we can
    // error out if needed
    peer.vm.middleware.middlewares[Instruction.STATE_TRANSITION_PROPOSE] = [];
    peer.vm.middleware.add(
      Instruction.STATE_TRANSITION_PROPOSE,
      async (message: InternalMessage, next: Function, context: Context) => {
        if (shouldError) {
          throw new Error("Crashing the machine on purpose");
        }
        return StateTransition.propose(message, next, context, peer.vm.cfState);
      }
    );
  }

  /**
   * Test force crashes the machine at first instruction of setup protocol,
   * so expect to see the first instruction twice and then the rest of
   * the setup protocol.
   */
  public validate() {
    const setupInstructions = JSON.parse(
      JSON.stringify(instructions[ActionName.SETUP])
    );
    setupInstructions.unshift(Instruction.STATE_TRANSITION_PROPOSE);
    expect(JSON.stringify(setupInstructions)).toEqual(
      JSON.stringify(this.executedInstructions)
    );
  }
}

class ResumeSecondInstructionTest extends SetupProtocolTestCase {
  public description(): string {
    return "should resume a protocol from the second instruction if it crashes during the second instruction";
  }

  public setupWallet(peer: TestResponseSink, shouldError: boolean) {
    // ensure the instructions are recorded so we can validate the test
    peer.vm.register(
      Instruction.ALL,
      async (message: InternalMessage, next: Function, context: Context) => {
        this.executedInstructions.push(message.opCode);
      }
    );

    // override the existing STATE_TRANSITION_PROPOSE middleware so we can
    // error out if needed
    peer.vm.middleware.middlewares[Instruction.OP_GENERATE] = [];
    peer.vm.middleware.add(
      Instruction.OP_GENERATE,
      async (message: InternalMessage, next: Function, context: Context) => {
        if (shouldError) {
          throw new Error("Crashing the machine on purpose");
        }
        const cfOpGenerator = new EthCfOpGenerator();
        return cfOpGenerator.generate(message, next, context, peer.vm.cfState);
      }
    );
  }

  /**
   * Test force crashes the machine at second instruction of setup protocol,
   * so expect to see the second instruction twice and then the rest of
   * the setup protocol.
   */
  public validate() {
    const setupInstructions = JSON.parse(
      JSON.stringify(instructions[ActionName.SETUP])
    );
    setupInstructions.splice(1, 0, Instruction.OP_GENERATE);
    expect(JSON.stringify(setupInstructions)).toEqual(
      JSON.stringify(this.executedInstructions)
    );
  }
}

class ResumeLastInstructionTest extends SetupProtocolTestCase {
  public description(): string {
    return "should resume a protocol from the last instruction if it crashes during the last instruction";
  }

  public setupWallet(peer: TestResponseSink, shouldError: boolean) {
    // ensure the instructions are recorded so we can validate the test
    peer.vm.register(
      Instruction.ALL,
      async (message: InternalMessage, next: Function, context: Context) => {
        this.executedInstructions.push(message.opCode);
      }
    );

    // override the existing STATE_TRANSITION_PROPOSE middleware so we can
    // error out if needed
    peer.vm.middleware.middlewares[Instruction.STATE_TRANSITION_COMMIT] = [];
    peer.vm.middleware.add(
      Instruction.STATE_TRANSITION_COMMIT,
      async (message: InternalMessage, next: Function, context: Context) => {
        if (shouldError) {
          throw new Error("Crashing the machine on purpose");
        }
        return StateTransition.commit(message, next, context, peer.vm.cfState);
      }
    );
  }

  /**
   * Test force crashes the machine at last instruction of setup protocol,
   * so expect to see the second last instruction twice and then the rest of
   * the setup protocol.
   */
  public validate() {
    const setupInstructions = JSON.parse(
      JSON.stringify(instructions[ActionName.SETUP])
    );
    setupInstructions.push(Instruction.STATE_TRANSITION_COMMIT);
    expect(JSON.stringify(setupInstructions)).toEqual(
      JSON.stringify(this.executedInstructions)
    );
  }
}

describe("Resume protocols", () => {
  const testCases = [
    new ResumeFirstInstructionTest(),
    new ResumeSecondInstructionTest(),
    new ResumeLastInstructionTest()
  ];

  testCases.forEach(testCase => {
    it(testCase.description(), async () => {
      await testCase.run();
    });
  });
});

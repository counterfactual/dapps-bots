import * as ethers from "ethers";
import lodash from "lodash";
import { Instruction } from "./instructions";
import {
  CfAppInterface,
  CfFreeBalance,
  CfNonce,
  Terms
} from "./middleware/cf-operation/types";
import { CfState, Context } from "./state";
import { Response, ResponseStatus } from "./vm";

/**
 * Aliases to help code readability.
 * Byte arrays and addresses are represented as hex-encoded strings.
 * Should think about actually changing these to be non strings.
 */
export type Bytes = string; // dynamically-sized byte array
export type Bytes4 = string; // fixed-size byte arrays
export type Bytes32 = string;
export type Address = string; // ethereum address (i.e. rightmost 20 bytes of keccak256 of ECDSA pubkey)
export type H256 = string; // a bytes32 which is the output of the keccak256 hash function

export interface MiddlewareResult {
  opCode: Instruction;
  value: any;
}

export interface WalletMessaging {
  postMessage(message: Object);

  onMessage(callback: Function);
}

export interface ClientMessage {
  requestId: string;
  appId?: string;
  appName?: string;
  type?: string;
  action: ActionName;
}

export interface Notification {
  type: string;
  notificationType: string;
  data: any;
}

export interface ClientActionMessage extends ClientMessage {
  data?: any;
  multisigAddress: string;
  toAddress: string;
  fromAddress: string;
  stateChannel?: StateChannelInfo; // we should remove this from this object
  seq: number;
  signature?: Signature;
}

export enum ClientQueryType {
  FreeBalance = "freeBalance",
  StateChannel = "stateChannel",
  User = "user"
}

export interface ClientQuery extends ClientMessage {
  requestId: string;
  query: ClientQueryType;
  data?: any;
  userId?: string;
  multisigAddress?: Address;
}

export interface InstallData {
  peerA: PeerBalance;
  peerB: PeerBalance;
  keyA?: Address;
  keyB?: Address;
  encodedAppState: Bytes;
  terms: Terms;
  app: CfAppInterface;
  timeout: number;
}

/**
 * The return value from the STATE_TRANSITION_PROPOSE middleware.
 */
export interface StateProposal {
  state: StateChannelInfos;
  cfAddr?: H256;
}

export type ProposerActionsHash = {
  [Name in ActionName]?: ContextualizedStateProposer
};

export interface ContextualizedStateProposer {
  propose(
    message: InternalMessage,
    context: Context,
    state: CfState
  ): StateProposal;
}

export interface ClientResponse {
  requestId: string;
  // TODO: tighten the type
  // https://github.com/counterfactual/monorepo/issues/162
  status?: any;
  data?: any;
  appId?: string;
}

export interface UserDataClientResponse extends ClientResponse {
  data: {
    userAddress: string;
    networkContext: Map<string, string>;
  };
}

export interface StateChannelDataClientResponse extends ClientResponse {
  data: {
    stateChannel: StateChannelInfo;
  };
}

export interface FreeBalanceClientResponse extends ClientResponse {
  requestId: string;
  data: {
    freeBalance: CfFreeBalance;
  };
}

export interface InstallClientResponse extends ClientResponse {
  data: {
    appId: string;
  };
}

export interface UpdateData {
  encodedAppState: string;
  /**
   * Hash of the State struct specific to a given application.
   */
  appStateHash: H256;
}

export interface UpdateOptions {
  state: object;
}

export interface UninstallOptions {
  peerABalance: ethers.utils.BigNumber;
  peerBBalance: ethers.utils.BigNumber;
}

export interface InstallOptions {
  appAddress: string;
  stateEncoding: string;
  abiEncoding: string;
  state: object;
  peerABalance: ethers.utils.BigNumber;
  peerBBalance: ethers.utils.BigNumber;
}

/**
 * peerA is always the address first in alphabetical order.
 */
export class CanonicalPeerBalance {
  public static canonicalize(
    peer1: PeerBalance,
    peer2: PeerBalance
  ): CanonicalPeerBalance {
    if (peer2.address.localeCompare(peer1.address) < 0) {
      return new CanonicalPeerBalance(peer2, peer1);
    }
    return new CanonicalPeerBalance(peer1, peer2);
  }

  constructor(readonly peerA: PeerBalance, readonly peerB: PeerBalance) {}
}

export class PeerBalance {
  /**
   * Returns an array of peer balance objects sorted by address ascendi.
   */
  public static balances(
    address1: Address,
    balance1: ethers.utils.BigNumber,
    address2: Address,
    balance2: ethers.utils.BigNumber
  ): CanonicalPeerBalance {
    if (address2.localeCompare(address1) < 0) {
      return new CanonicalPeerBalance(
        new PeerBalance(address2, balance2),
        new PeerBalance(address1, balance1)
      );
    }
    return new CanonicalPeerBalance(
      new PeerBalance(address1, balance1),
      new PeerBalance(address2, balance2)
    );
  }

  public static add(bals: PeerBalance[], inc: PeerBalance[]): PeerBalance[] {
    return [
      new PeerBalance(bals[0].address, bals[0].balance.add(inc[0].balance)),
      new PeerBalance(bals[1].address, bals[1].balance.add(inc[1].balance))
    ];
  }

  /**
   * @assume each array is of length 2.
   */
  public static subtract(
    oldBals: PeerBalance[],
    newBals: PeerBalance[]
  ): PeerBalance[] {
    if (oldBals[0].address === newBals[0].address) {
      return [
        new PeerBalance(
          oldBals[0].address,
          oldBals[0].balance.sub(newBals[0].balance)
        ),
        new PeerBalance(
          oldBals[1].address,
          oldBals[1].balance.sub(newBals[1].balance)
        )
      ];
    }
    return [
      new PeerBalance(
        oldBals[0].address,
        oldBals[0].balance.sub(newBals[1].balance)
      ),
      new PeerBalance(
        oldBals[1].address,
        oldBals[1].balance.sub(newBals[0].balance)
      )
    ];
  }
  public balance: ethers.utils.BigNumber;

  constructor(
    readonly address: Address,
    balance: number | ethers.utils.BigNumber
  ) {
    this.balance = ethers.utils.bigNumberify(balance.toString());
  }
}

/**
 * A network context is a set of contract wrappers of the global contracts that
 * are deployed. A global contract provides functionality in such a way that all
 * channels can use the same global contract, hence they only need to be
 * deployed once. The exceptions to the global contracts are the Multisig
 * and the AppInstance contracts.
 *
 * @Param contractArtifacts Mapping of contract name to string list of
 * [abi, bytecode]
 */
export class NetworkContext {
  // FIXME: This is just bad practice :S
  // https://github.com/counterfactual/monorepo/issues/177
  private contractToVar = {
    Registry: "registryAddr",
    PaymentApp: "paymentAppAddr",
    ConditionalTransaction: "conditionalTransactionAddr",
    MultiSend: "multiSendAddr",
    NonceRegistry: "nonceRegistryAddr",
    Signatures: "signaturesAddr",
    StaticCall: "staticCallAddr",
    ETHBalanceRefundApp: "ethBalanceRefundAppAddr"
  };

  constructor(
    readonly registryAddr: Address,
    readonly paymentAppAddr: Address,
    readonly conditionalTransactionAddr: Address,
    readonly multiSendAddr: Address,
    readonly nonceRegistryAddr: Address,
    readonly signaturesAddr: Address,
    readonly staticCallAddr: Address,
    readonly ethBalanceRefundAppAddr: Address
  ) {}

  public linkBytecode(unlinkedBytecode: string): string {
    let bytecode = unlinkedBytecode;
    for (const contractName of lodash.keys(this.contractToVar)) {
      const regex = new RegExp(`__${contractName}_+`, "g");
      const address = this[this.contractToVar[contractName]].substr(2);
      bytecode = bytecode.replace(regex, address);
    }
    return bytecode;
  }
}

// Tree of all the stateChannel and appChannel state
export interface ChannelStates {
  [s: string]: StateChannelInfo;
}

export interface StateChannelInfo {
  counterParty: Address;
  me: Address;
  multisigAddress: Address;
  appChannels: AppChannelInfos;
  freeBalance: CfFreeBalance;

  // TODO: Move this out of the datastructure
  // https://github.com/counterfactual/monorepo/issues/163
  /**
   * @returns the addresses of the owners of this state channel sorted
   *          in alphabetical order.
   */
  owners(): string[];
}

export interface AppChannelInfo {
  // cf address
  id: H256;
  // used to generate cf address
  uniqueId: number;
  peerA: PeerBalance;
  peerB: PeerBalance;
  // ephemeral keys
  keyA?: Address;
  keyB?: Address;
  encodedState: any;
  appState?: any;
  appStateHash?: H256;
  localNonce: number;
  timeout: number;
  terms: Terms;
  cfApp: CfAppInterface;
  dependencyNonce: CfNonce;

  // TODO: Move this into a method that is outside the data structure
  // https://github.com/counterfactual/monorepo/issues/164
  stateChannel?: StateChannelInfo;
}

export interface StateChannelInfos {
  [s: string]: StateChannelInfo;
}

export interface AppChannelInfos {
  [s: string]: AppChannelInfo;
}

export interface OpCodeResult {
  opCode: Instruction;
  value: any;
}

// TODO: document what this is
// https://github.com/counterfactual/monorepo/issues/165
export interface ResponseSink {
  sendResponse(res: Response);
}

export class CfPeerAmount {
  constructor(readonly addr: string, public amount: number) {}
}

// eg. 'dfee8149d73c19def9cfaf3ea73e95f4f7606826de8d3355eeaf1fd992b2b0f302616ad09ccee8025e5ba345763ee0de9a75b423bbb0ea8da2b2cc34391bc7e628'
const SIGNATURE_LENGTH_WITHOUT_PREFIX = 130;
const V_LENGTH = 2;
const R_LENGTH = 64;
const S_LENGTH = 64;

export class Signature {
  get recoveryParam() {
    return this.v - 27;
  }

  public static toSortedBytes(signatures: Signature[], digest: H256): Bytes {
    const sigs = signatures.slice();
    sigs.sort((sigA, sigB) => {
      const addrA = sigA.recoverAddress(digest);
      const addrB = sigB.recoverAddress(digest);
      return new ethers.utils.BigNumber(addrA).lt(addrB) ? -1 : 1;
    });
    const signatureStrings = sigs.map(sig => {
      return (
        ethers.utils.hexlify(ethers.utils.padZeros(sig.r, 32)).substring(2) +
        ethers.utils.hexlify(ethers.utils.padZeros(sig.s, 32)).substring(2) +
        sig.v.toString(16)
      );
    });
    return `0x${signatureStrings.join("")}`;
  }

  /**
   * Helper method in verifying signatures in transactions
   * @param signatures
   */
  public static fromBytes(signatures: Bytes): Signature[] {
    // chop off the 0x prefix
    let sigs = signatures.substr(2);
    if (sigs.length % SIGNATURE_LENGTH_WITHOUT_PREFIX !== 0) {
      throw Error("The bytes string representing the signatures is malformed.");
    }
    const signaturesList: Signature[] = [];
    while (sigs.length !== 0) {
      const sig = sigs.substr(0, SIGNATURE_LENGTH_WITHOUT_PREFIX);
      sigs = sigs.substr(SIGNATURE_LENGTH_WITHOUT_PREFIX);
      // note: +<string> is syntactic sugar for parsing a number from a string
      const v = +sig.substr(SIGNATURE_LENGTH_WITHOUT_PREFIX - V_LENGTH);
      const r = `0x${sig.substr(0, R_LENGTH)}`;
      const s = `0x${sig.substr(R_LENGTH, S_LENGTH)}`;
      signaturesList.push(new Signature(v, r, s));
    }
    return signaturesList;
  }

  // TODO: fix types
  // https://github.com/counterfactual/monorepo/issues/166
  constructor(readonly v: number, readonly r: string, readonly s: string) {}

  public recoverAddress(digest: H256): Address {
    return ethers.utils.recoverAddress(digest, this.toString());
  }

  public toString(): string {
    return `0x${this.r.substr(2)}${this.s.substr(2)}${ethers.utils
      .hexlify(this.v)
      .substr(2)}`;
  }
}

// FIXME: move operation action names away from client action names
// https://github.com/counterfactual/monorepo/issues/178
export enum ActionName {
  SETUP = "setup",
  INSTALL = "install",
  UPDATE = "update",
  UNINSTALL = "uninstall",
  DEPOSIT = "deposit",
  ADD_OBSERVER = "addObserver",
  REMOVE_OBSERVER = "removeObserver",
  REGISTER_IO = "registerIo",
  RECEIVE_IO = "receiveIo",
  QUERY = "query",
  CONNECT = "connect"
}

export interface Addressable {
  appId?: H256;
  multisigAddress?: Address;
  toAddress?: Address;
  fromAddress?: Address;
}

export class InternalMessage {
  constructor(
    public actionName: ActionName,
    public opCode: Instruction,
    public clientMessage: ClientActionMessage,
    public isAckSide: boolean
  ) {}
}

export class WalletMessage {
  constructor(id: string, status: ResponseStatus, readonly type?: string) {}
}

export class WalletResponse {
  constructor(
    readonly requestId: string,
    readonly status: ResponseStatus,
    readonly type?: string,
    error?: string
  ) {}
}

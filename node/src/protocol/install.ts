import {
  CoinTransferInterpreterParams,
  coinTransferInterpreterParamsStateEncoding,
  NetworkContext,
  OutcomeType,
  TwoPartyFixedOutcomeInterpreterParams
} from "@counterfactual/types";
import { BigNumber, bigNumberify, defaultAbiCoder } from "ethers/utils";

import { SetStateCommitment } from "../ethereum";
import { ConditionalTransaction } from "../ethereum/conditional-transaction-commitment";
import { ProtocolExecutionFlow } from "../machine";
import { Opcode, Protocol } from "../machine/enums";
import { Context, InstallParams, ProtocolMessage } from "../machine/types";
import { AppInstance, StateChannel } from "../models";
import { TokenIndexedCoinTransferMap } from "../models/free-balance";

import { UNASSIGNED_SEQ_NO } from "./utils/signature-forwarder";
import { assertIsValidSignature } from "./utils/signature-validator";

/**
 * @description This exchange is described at the following URL:
 *
 * specs.counterfactual.com/05-install-protocol#messages
 */
export const INSTALL_PROTOCOL: ProtocolExecutionFlow = {
  /**
   * Sequence 0 of the INSTALL_PROTOCOL requires the initiator party
   * to sign the ConditionalTransactionCommitment for the as-yet un-funded
   * newly proposed AppInstance, wait for a countersignature, and then when
   * received countersign the _also received_ free balance state update to
   * activate / fund the new app, and send the signature to that back to the
   * counterparty to finish the protocol.
   *
   * @param {Context} context
   */

  0 /* Initiating */: async function*(context: Context) {
    const {
      stateChannelsMap,
      message: { params, protocolExecutionID },
      network
    } = context;

    const {
      responderXpub,
      multisigAddress,
      outcomeType
    } = params as InstallParams;

    const preProtocolStateChannel = stateChannelsMap.get(multisigAddress)!;

    const postProtocolStateChannel = computeStateChannelTransition(
      preProtocolStateChannel,
      params as InstallParams
    );

    const newAppInstance = postProtocolStateChannel.mostRecentlyInstalledAppInstance();

    const conditionalTransactionData = constructConditionalTransactionData(
      network,
      outcomeType,
      postProtocolStateChannel
    );

    const mySignatureOnConditionalTransaction = yield [
      Opcode.OP_SIGN,
      conditionalTransactionData
    ];

    const {
      signature: counterpartySignatureOnConditionalTransaction,
      signature2: counterpartySignatureOnFreeBalanceStateUpdate
    } = yield [
      Opcode.IO_SEND_AND_WAIT,
      {
        protocolExecutionID,
        params,
        protocol: Protocol.Install,
        toXpub: responderXpub,
        signature: mySignatureOnConditionalTransaction,
        seq: 1
      } as ProtocolMessage
    ];

    assertIsValidSignature(
      preProtocolStateChannel.getFreeBalanceAddrOf(responderXpub),
      conditionalTransactionData,
      counterpartySignatureOnConditionalTransaction
    );

    const signedConditionalTransaction = conditionalTransactionData.getSignedTransaction(
      [
        mySignatureOnConditionalTransaction,
        counterpartySignatureOnConditionalTransaction
      ]
    );

    context.stateChannelsMap.set(
      postProtocolStateChannel.multisigAddress,
      postProtocolStateChannel
    );

    yield [
      Opcode.WRITE_COMMITMENT,
      Protocol.Install,
      signedConditionalTransaction,
      newAppInstance.identityHash
    ];

    const freeBalanceUpdateData = new SetStateCommitment(
      network,
      postProtocolStateChannel.freeBalance.identity,
      postProtocolStateChannel.freeBalance.hashOfLatestState,
      postProtocolStateChannel.freeBalance.versionNumber,
      postProtocolStateChannel.freeBalance.timeout
    );

    assertIsValidSignature(
      preProtocolStateChannel.getFreeBalanceAddrOf(responderXpub),
      freeBalanceUpdateData,
      counterpartySignatureOnFreeBalanceStateUpdate
    );

    const mySignatureOnFreeBalanceStateUpdate = yield [
      Opcode.OP_SIGN,
      freeBalanceUpdateData
    ];

    const signedFreeBalanceStateUpdate = freeBalanceUpdateData.getSignedTransaction(
      [
        mySignatureOnFreeBalanceStateUpdate,
        counterpartySignatureOnFreeBalanceStateUpdate
      ]
    );

    yield [
      Opcode.WRITE_COMMITMENT,
      Protocol.Update,
      signedFreeBalanceStateUpdate,
      postProtocolStateChannel.freeBalance.identityHash
    ];

    yield [
      Opcode.IO_SEND,
      {
        protocolExecutionID,
        protocol: Protocol.Install,
        toXpub: responderXpub,
        signature: mySignatureOnFreeBalanceStateUpdate,
        seq: UNASSIGNED_SEQ_NO
      } as ProtocolMessage
    ];
  },

  /**
   * Sequence 1 of the INSTALL_PROTOCOL requires the responder party
   * to countersignsign the ConditionalTransactionCommitment and then sign
   * the update to the free balance object, wait for the intitiating party to
   * sign _that_ and then finish the protocol.
   *
   * @param {Context} context
   */

  1 /* Responding */: async function*(context: Context) {
    const {
      stateChannelsMap,
      message: { params, protocolExecutionID, signature },
      network
    } = context;

    // Aliasing `signature` to this variable name for code clarity
    const counterpartySignatureOnConditionalTransaction = signature;

    const {
      initiatorXpub,
      multisigAddress,
      outcomeType
    } = params as InstallParams;

    const preProtocolStateChannel = stateChannelsMap.get(multisigAddress)!;

    const postProtocolStateChannel = computeStateChannelTransition(
      preProtocolStateChannel,
      params as InstallParams
    );

    const newAppInstance = postProtocolStateChannel.mostRecentlyInstalledAppInstance();

    const conditionalTransactionData = constructConditionalTransactionData(
      network,
      outcomeType,
      postProtocolStateChannel
    );

    assertIsValidSignature(
      preProtocolStateChannel.getFreeBalanceAddrOf(initiatorXpub),
      conditionalTransactionData,
      counterpartySignatureOnConditionalTransaction
    );

    const mySignatureOnConditionalTransaction = yield [
      Opcode.OP_SIGN,
      conditionalTransactionData
    ];

    const signedConditionalTransaction = conditionalTransactionData.getSignedTransaction(
      [
        mySignatureOnConditionalTransaction,
        counterpartySignatureOnConditionalTransaction
      ]
    );

    context.stateChannelsMap.set(
      postProtocolStateChannel.multisigAddress,
      postProtocolStateChannel
    );

    yield [
      Opcode.WRITE_COMMITMENT,
      Protocol.Install,
      signedConditionalTransaction,
      newAppInstance.identityHash
    ];

    const freeBalanceUpdateData = new SetStateCommitment(
      network,
      postProtocolStateChannel.freeBalance.identity,
      postProtocolStateChannel.freeBalance.hashOfLatestState,
      postProtocolStateChannel.freeBalance.versionNumber,
      postProtocolStateChannel.freeBalance.timeout
    );

    const mySignatureOnFreeBalanceStateUpdate = yield [
      Opcode.OP_SIGN,
      freeBalanceUpdateData
    ];

    const { signature: counterpartySignatureOnFreeBalanceStateUpdate } = yield [
      Opcode.IO_SEND_AND_WAIT,
      {
        protocolExecutionID,
        protocol: Protocol.Install,
        toXpub: initiatorXpub,
        signature: mySignatureOnConditionalTransaction,
        signature2: mySignatureOnFreeBalanceStateUpdate,
        seq: UNASSIGNED_SEQ_NO
      } as ProtocolMessage
    ];

    assertIsValidSignature(
      preProtocolStateChannel.getFreeBalanceAddrOf(initiatorXpub),
      freeBalanceUpdateData,
      counterpartySignatureOnFreeBalanceStateUpdate
    );

    const signedFreeBalanceStateUpdate = freeBalanceUpdateData.getSignedTransaction(
      [
        mySignatureOnFreeBalanceStateUpdate,
        counterpartySignatureOnFreeBalanceStateUpdate
      ]
    );

    yield [
      Opcode.WRITE_COMMITMENT,
      Protocol.Update,
      signedFreeBalanceStateUpdate,
      postProtocolStateChannel.freeBalance.identityHash
    ];
  }
};

/**
 * Generates the would-be new StateChannel to represent the final state of the
 * StateChannel after the protocol would be executed with correct signatures.
 *
 * @param {StateChannel} stateChannel - The pre-protocol state of the channel
 * @param {InstallParams} params - Parameters about the new AppInstance
 *
 * @returns {Promise<StateChannel>} - The post-protocol state of the channel
 */
function computeStateChannelTransition(
  stateChannel: StateChannel,
  params: InstallParams
): StateChannel {
  const {
    initiatorBalanceDecrement,
    responderBalanceDecrement,
    initiatorDepositTokenAddress,
    responderDepositTokenAddress,
    initiatorXpub,
    responderXpub,
    participants,
    initialState,
    appInterface,
    defaultTimeout,
    multisigAddress,
    outcomeType
  } = params;

  const initiatorFbAddress = stateChannel.getFreeBalanceAddrOf(initiatorXpub);
  const responderFbAddress = stateChannel.getFreeBalanceAddrOf(responderXpub);

  const {
    coinTransferInterpreterParams,
    twoPartyOutcomeInterpreterParams
  } = computeInterpreterParameters(
    outcomeType,
    initiatorDepositTokenAddress,
    responderDepositTokenAddress,
    initiatorBalanceDecrement,
    responderBalanceDecrement,
    initiatorFbAddress,
    responderFbAddress
  );

  const appInstanceToBeInstalled = new AppInstance(
    /* multisigAddress */ multisigAddress,
    /* participants */ participants,
    /* defaultTimeout */ defaultTimeout,
    /* appInterface */ appInterface,
    /* isVirtualApp */ false,
    /* appSeqNo */ stateChannel.numInstalledApps,
    /* latestState */ initialState,
    /* latestVersionNumber */ 0,
    /* defaultTimeout */ defaultTimeout,
    /* outcomeType */ outcomeType,
    /* twoPartyOutcomeInterpreterParams */ twoPartyOutcomeInterpreterParams,
    /* coinTransferInterpreterParams */ coinTransferInterpreterParams
  );

  let tokenIndexedBalanceDecrement: TokenIndexedCoinTransferMap;
  if (initiatorDepositTokenAddress !== responderDepositTokenAddress) {
    tokenIndexedBalanceDecrement = {
      [initiatorDepositTokenAddress]: {
        [initiatorFbAddress]: initiatorBalanceDecrement
      },
      [responderDepositTokenAddress]: {
        [responderFbAddress]: responderBalanceDecrement
      }
    };
  } else {
    // If the decrements are on the same token, the previous block
    // sets the decrement only on the `respondingFbAddress` and the
    // `initiatingFbAddress` would get overwritten
    tokenIndexedBalanceDecrement = {
      [initiatorDepositTokenAddress]: {
        [initiatorFbAddress]: initiatorBalanceDecrement,
        [responderFbAddress]: responderBalanceDecrement
      }
    };
  }

  return stateChannel.installApp(
    appInstanceToBeInstalled,
    tokenIndexedBalanceDecrement
  );
}

/**
 * Returns the parameters for two hard-coded possible interpreter types.
 *
 * Note that this is _not_ a built-in part of the protocol. Here we are _restricting_
 * all newly installed AppInstances to be either of type COIN_TRANSFER or
 * TWO_PARTY_FIXED_OUTCOME. In the future, we will be extending the InstallParams
 * to indidicate the interpreterAddress and interpreterParams so the developers
 * installing apps have more control, however for now we are putting this logic
 * inside of the client (the Node) by adding an "outcomeType" variable which
 * is a simplification of the actual decision a developer has to make with their app.
 *
 * TODO: update doc on how CoinTransferInterpreterParams work
 *
 * @param {OutcomeType} outcomeType - either COIN_TRANSFER or TWO_PARTY_FIXED_OUTCOME
 * @param {BigNumber} initiatorBalanceDecrement - amount Wei initiator deposits
 * @param {BigNumber} responderBalanceDecrement - amount Wei responder deposits
 * @param {string} initiatorFbAddress - the address of the recipient of initiator
 * @param {string} responderFbAddress - the address of the recipient of responder
 *
 * @returns An object with the required parameters for both interpreter types, one
 * will be undefined and the other will be a correctly structured POJO. The AppInstance
 * object currently accepts both in its constructor and internally manages them.
 */
function computeInterpreterParameters(
  outcomeType: OutcomeType,
  initiatorDepositTokenAddress: string,
  responderDepositTokenAddress: string,
  initiatorBalanceDecrement: BigNumber,
  responderBalanceDecrement: BigNumber,
  initiatorFbAddress: string,
  responderFbAddress: string
) {
  let coinTransferInterpreterParams: CoinTransferInterpreterParams | undefined;

  let twoPartyOutcomeInterpreterParams:
    | TwoPartyFixedOutcomeInterpreterParams
    | undefined;

  switch (outcomeType) {
    case OutcomeType.REFUND_OUTCOME_TYPE: {
      const limit: BigNumber[] = [];
      const tokens: string[] = [];

      // Deposit is taking place by the initiator
      if (responderDepositTokenAddress === undefined) {
        limit.push(initiatorBalanceDecrement);
        tokens.push(initiatorDepositTokenAddress);
      } else if (
        initiatorDepositTokenAddress === responderDepositTokenAddress
      ) {
        limit.push(initiatorBalanceDecrement.add(responderBalanceDecrement));
        tokens.push(initiatorDepositTokenAddress);
      } else {
        tokens.push(initiatorDepositTokenAddress);
        limit.push(initiatorBalanceDecrement);

        tokens.push(responderDepositTokenAddress);
        limit.push(responderBalanceDecrement);
      }

      coinTransferInterpreterParams = {
        limit,
        tokens
      };
      break;
    }
    case OutcomeType.TWO_PARTY_FIXED_OUTCOME: {
      twoPartyOutcomeInterpreterParams = {
        playerAddrs: [initiatorFbAddress, responderFbAddress],
        amount: bigNumberify(initiatorBalanceDecrement).add(
          responderBalanceDecrement
        )
      };
      break;
    }
    default: {
      throw new Error(
        "The outcome type in this application logic contract is not supported yet."
      );
    }
  }

  return { coinTransferInterpreterParams, twoPartyOutcomeInterpreterParams };
}

/**
 * Computes the ConditionalTransaction unsigned transaction from the multisignature
 * wallet that is required to be signed by all parties involved in the protocol.
 *
 * @param {NetworkContext} network - Metadata on the current blockchain
 * @param {OutcomeType} outcomeType - The outcome type of the AppInstance
 * @param {StateChannel} stateChannel - The post-protocol StateChannel
 *
 * @returns {ConditionalTransaction} A ConditionalTransaction object, ready to sign.
 */
function constructConditionalTransactionData(
  network: NetworkContext,
  outcomeType: OutcomeType,
  stateChannel: StateChannel
): ConditionalTransaction {
  const appInstance = stateChannel.mostRecentlyInstalledAppInstance();

  let interpreterAddress: string;
  let interpreterParams: string;

  switch (outcomeType) {
    case OutcomeType.REFUND_OUTCOME_TYPE: {
      interpreterAddress = network.CoinTransferInterpreter;
      interpreterParams = defaultAbiCoder.encode(
        [coinTransferInterpreterParamsStateEncoding],
        [appInstance.coinTransferInterpreterParams]
      );
      break;
    }
    case OutcomeType.TWO_PARTY_FIXED_OUTCOME: {
      interpreterAddress = network.TwoPartyFixedOutcomeETHInterpreter;
      interpreterParams = defaultAbiCoder.encode(
        ["tuple(address[2] playerAddrs, uint256 amount)"],
        [appInstance.twoPartyOutcomeInterpreterParams]
      );
      break;
    }
    default: {
      throw new Error(
        "The outcome type in this application logic contract is not supported yet."
      );
    }
  }

  return new ConditionalTransaction(
    network,
    stateChannel.multisigAddress,
    stateChannel.multisigOwners,
    appInstance.identityHash,
    stateChannel.freeBalance.identityHash,
    interpreterAddress,
    interpreterParams
  );
}

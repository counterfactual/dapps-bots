import { setFinalCommitment } from "@counterfactual/machine/src/protocol/utils/set-final-commitment";
import { AssetType, NetworkContext } from "@counterfactual/types";

import { ProtocolExecutionFlow } from "..";
import { Opcode } from "../enums";
import { InstallCommitment } from "../ethereum";
import { AppInstance, StateChannel } from "../models";
import { Context, InstallParams, ProtocolMessage } from "../types";
import { xkeyKthAddress } from "../xkeys";

import { verifyInboxLengthEqualTo1 } from "./utils/inbox-validator";
import {
  addSignedCommitmentInResponse,
  addSignedCommitmentToOutboxForSeq1
} from "./utils/signature-forwarder";
import { validateSignature } from "./utils/signature-validator";

/**
 * @description This exchange is described at the following URL:
 *
 * specs.counterfactual.com/05-install-protocol#messages
 *
 */
export const INSTALL_PROTOCOL: ProtocolExecutionFlow = {
  0: [
    // Compute the next state of the channel
    proposeStateTransition,

    // Sign `context.commitment.hashToSign`
    Opcode.OP_SIGN,

    // Wrap the signature into a message to be sent
    addSignedCommitmentToOutboxForSeq1,

    // Send the message to your counterparty and wait for a reply
    Opcode.IO_SEND_AND_WAIT,

    // Verify a message was received
    (_: ProtocolMessage, context: Context) =>
      verifyInboxLengthEqualTo1(context.inbox),

    // Verify they did indeed countersign the right thing
    (message: ProtocolMessage, context: Context) =>
      validateSignature(
        xkeyKthAddress(message.toXpub, 0),
        context.commitments[0],
        context.inbox[0].signature
      ),

    setFinalCommitment(true),

    Opcode.WRITE_COMMITMENT
  ],

  1: [
    // Compute the _proposed_ next state of the channel
    proposeStateTransition,

    // Validate your counterparty's signature is for the above proposal
    (message: ProtocolMessage, context: Context) =>
      validateSignature(
        xkeyKthAddress(message.fromXpub, 0),
        context.commitments[0],
        message.signature
      ),

    // Sign the same state update yourself
    Opcode.OP_SIGN,

    setFinalCommitment(false),

    Opcode.WRITE_COMMITMENT,

    // Wrap the signature into a message to be sent
    addSignedCommitmentInResponse,

    // Send the message to your counterparty
    Opcode.IO_SEND
  ]
};

function proposeStateTransition(message: ProtocolMessage, context: Context) {
  const {
    aliceBalanceDecrement,
    bobBalanceDecrement,
    signingKeys,
    initialState,
    terms,
    appInterface,
    defaultTimeout,
    multisigAddress
  } = message.params as InstallParams;

  const stateChannel = context.stateChannelsMap.get(multisigAddress)!;

  const appInstance = new AppInstance(
    multisigAddress,
    signingKeys,
    defaultTimeout,
    appInterface,
    terms,
    // KEY: Sets it to NOT be a virtual app
    false,
    // KEY: The app sequence number
    stateChannel.numInstalledApps,
    stateChannel.rootNonceValue,
    initialState,
    // KEY: Set the nonce to be 0
    0,
    defaultTimeout
  );

  const newStateChannel = stateChannel.installApp(
    appInstance,
    aliceBalanceDecrement,
    bobBalanceDecrement
  );

  context.stateChannelsMap.set(multisigAddress, newStateChannel);

  const appIdentityHash = appInstance.identityHash;

  context.commitments[0] = constructInstallOp(
    context.network,
    newStateChannel,
    appIdentityHash
  );

  context.appIdentityHash = appIdentityHash;
}

function constructInstallOp(
  network: NetworkContext,
  stateChannel: StateChannel,
  appIdentityHash: string
) {
  const app = stateChannel.getAppInstance(appIdentityHash);

  const freeBalance = stateChannel.getFreeBalanceFor(AssetType.ETH);

  return new InstallCommitment(
    network,
    stateChannel.multisigAddress,
    stateChannel.multisigOwners,
    app.identity,
    app.terms,
    freeBalance.identity,
    freeBalance.terms,
    freeBalance.hashOfLatestState,
    freeBalance.nonce,
    freeBalance.timeout,
    app.appSeqNo,
    freeBalance.rootNonceValue
  );
}

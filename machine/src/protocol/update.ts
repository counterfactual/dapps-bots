import { NetworkContext } from "@counterfactual/types";

import { SetStateCommitment } from "../ethereum";
import { StateChannel } from "../models/state-channel";
import { Opcode } from "../opcodes";
import { ProtocolMessage, UpdateParams } from "../protocol-types-tbd";
import { Context } from "../types";

import { prepareToSendSignature } from "./utils/signature-forwarder";

/**
 * @description This exchange is described at the following URL:
 *
 * specs.counterfactual.com/07-update-protocol#messages
 *
 */
export const UPDATE_PROTOCOL = {
  0: [
    // Compute the next state of the channel
    proposeStateTransition,

    // Sign `context.commitment.hashToSign`
    Opcode.OP_SIGN,

    // Wrap the signature into a message to be sent
    prepareToSendSignature,

    // Send the message to your counterparty
    Opcode.IO_SEND,

    // Wait for them to countersign the message
    Opcode.IO_WAIT,

    // Verify they did indeed countersign the right thing
    Opcode.OP_SIGN_VALIDATE,

    // Consider the state transition finished and commit it
    Opcode.STATE_TRANSITION_COMMIT
  ],

  1: [
    // Compute the _proposed_ next state of the channel
    proposeStateTransition,

    // Validate your counterparties signature is for the above proposal
    Opcode.OP_SIGN_VALIDATE,

    // Sign the same state update yourself
    Opcode.OP_SIGN,

    // Wrap the signature into a message to be sent
    prepareToSendSignature,

    // Send the message to your counterparty
    Opcode.IO_SEND,

    // Consider the state transition finished and commit it
    Opcode.STATE_TRANSITION_COMMIT
  ]
};

function proposeStateTransition(
  message: ProtocolMessage,
  context: Context,
  stateChannel: StateChannel
) {
  const { appIdentityHash, newState } = message.params as UpdateParams;
  context.stateChannel = stateChannel.setState(appIdentityHash, newState);
  context.commitment = constructUpdateOp(
    context.network,
    context.stateChannel,
    appIdentityHash
  );
  context.appIdentityHash = appIdentityHash;
}

export function constructUpdateOp(
  network: NetworkContext,
  stateChannel: StateChannel,
  appIdentityHash: string
) {
  const app = stateChannel.getAppInstance(appIdentityHash);

  return new SetStateCommitment(
    network,
    app.identity,
    app.hashOfLatestState,
    app.nonce,
    app.timeout
  );
}

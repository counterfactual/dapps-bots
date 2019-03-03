import { NetworkContext } from "@counterfactual/types";
import { AddressZero, HashZero } from "ethers/constants";

import { Context, Protocol, StateChannel } from "../../../src";
import {
  addSignedCommitmentInResponse,
  addSignedCommitmentToOutboxForSeq1
} from "../../../src/protocol/utils/signature-forwarder";
import { ProtocolMessage } from "../../../src/types";

describe("Signature Forwarder Helpers", () => {
  let message: ProtocolMessage;
  let context: Context;

  beforeEach(() => {
    message = {
      protocol: Protocol.Setup,
      params: {
        initiatingXpub: AddressZero,
        respondingXpub: AddressZero,
        multisigAddress: AddressZero
      },
      fromXpub: AddressZero,
      toXpub: AddressZero,
      seq: 0,
      signature: undefined
    };

    context = {
      signatures: [
        {
          v: 0,
          r: HashZero,
          s: HashZero
        }
      ],
      commitments: [],
      outbox: [],
      inbox: [],
      network: {} as NetworkContext,
      stateChannelsMap: new Map<string, StateChannel>()
    };
  });

  it("addSignedCommitmentInResponse should add a message to the outbox", () => {
    addSignedCommitmentInResponse(message, context);

    expect(context.outbox.length).toBe(1);
    expect(context.outbox[0].fromXpub).toBe(message.fromXpub);
    expect(context.outbox[0].toXpub).toBe(message.toXpub);
    expect(context.outbox[0].params).toEqual(message.params);
    expect(context.outbox[0].protocol).toBe(message.protocol);
    expect(context.outbox[0].seq).toBe(-1);
    expect(context.outbox[0].signature).toBe(context.signatures[0]);
  });

  it("addSignedCommitmentToOutboxForSeq1 should add a message to the outbox", () => {
    addSignedCommitmentToOutboxForSeq1(message, context);

    expect(context.outbox.length).toBe(1);
    expect(context.outbox[0].fromXpub).toBe(message.fromXpub);
    expect(context.outbox[0].toXpub).toBe(message.toXpub);
    expect(context.outbox[0].params).toEqual(message.params);
    expect(context.outbox[0].protocol).toBe(message.protocol);
    expect(context.outbox[0].seq).toBe(1);
    expect(context.outbox[0].signature).toBe(context.signatures[0]);
  });
});

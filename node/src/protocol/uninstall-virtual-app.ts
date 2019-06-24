import { ETHBucketAppState, NetworkContext } from "@counterfactual/types";
import { BaseProvider } from "ethers/providers";
import { fromExtendedKey } from "ethers/utils/hdnode";

import { UninstallCommitment, VirtualAppSetStateCommitment } from "../ethereum";
import { ProtocolExecutionFlow } from "../machine";
import { Opcode, Protocol } from "../machine/enums";
import {
  Context,
  ProtocolMessage,
  ProtocolParameters,
  UninstallVirtualAppParams
} from "../machine/types";
import { virtualChannelKey } from "../machine/virtual-app-key";
import { xkeyKthAddress } from "../machine/xkeys";
import { StateChannel } from "../models";

import { getChannelFromCounterparty } from "./utils/get-channel-from-counterparty";
import { computeFreeBalanceIncrements } from "./utils/get-outcome-increments";
import { validateSignature } from "./utils/signature-validator";

const zA = (xpub: string) => {
  return fromExtendedKey(xpub).derivePath("0").address;
};

export const UNINSTALL_VIRTUAL_APP_PROTOCOL: ProtocolExecutionFlow = {
  0: async function*(context: Context) {
    const { intermediaryXpub, respondingXpub } = context.message
      .params as UninstallVirtualAppParams;
    const intermediaryAddress = xkeyKthAddress(intermediaryXpub, 0);
    const respondingAddress = xkeyKthAddress(respondingXpub, 0);

    const lockCommitment = addVirtualAppStateTransitionToContext(
      context.message.params,
      context,
      false
    );

    const s1 = yield [Opcode.OP_SIGN, lockCommitment];

    const m4 = yield [
      Opcode.IO_SEND_AND_WAIT,
      {
        // m1
        protocol: Protocol.UninstallVirtualApp,
        protocolExecutionID: context.message.protocolExecutionID,
        params: context.message.params,
        seq: 1,
        toXpub: intermediaryXpub,
        signature: s1
      } as ProtocolMessage
    ];

    const { signature: s3, signature2: s2 } = m4;

    validateSignature(respondingAddress, lockCommitment, s3);
    validateSignature(intermediaryAddress, lockCommitment, s2, true);

    const uninstallLeft = await addLeftUninstallAgreementToContext(
      context.message.params,
      context,
      context.provider
    );

    const s4 = yield [Opcode.OP_SIGN, uninstallLeft];

    // send m5, wait for m6
    const { signature: s6 } = yield [
      Opcode.IO_SEND_AND_WAIT,
      {
        protocolExecutionID: context.message.protocolExecutionID,
        seq: -1,
        toXpub: intermediaryXpub,
        signature: s4
      }
    ];

    validateSignature(intermediaryAddress, uninstallLeft, s6);
    removeVirtualAppInstance(context.message.params, context);
  },

  1: async function*(context: Context) {
    const { initiatingXpub, respondingXpub } = context.message
      .params as UninstallVirtualAppParams;
    const initiatingAddress = xkeyKthAddress(initiatingXpub, 0);
    const respondingAddress = xkeyKthAddress(respondingXpub, 0);

    const lockCommitment = addVirtualAppStateTransitionToContext(
      context.message.params,
      context,
      true
    );

    // m1 contains s1
    const s1 = context.message.signature;

    validateSignature(initiatingAddress, lockCommitment, s1);

    const s2 = yield [Opcode.OP_SIGN_AS_INTERMEDIARY, lockCommitment];

    const m3 = yield [
      Opcode.IO_SEND_AND_WAIT,
      {
        // m2
        protocol: Protocol.UninstallVirtualApp,
        protocolExecutionID: context.message.protocolExecutionID,
        params: context.message.params,
        seq: 2,
        toXpub: respondingXpub,
        signature: s1,
        signature2: s2
      } as ProtocolMessage
    ];
    const { signature: s3 } = m3;

    validateSignature(respondingAddress, lockCommitment, s3);

    const m5 = yield [
      Opcode.IO_SEND_AND_WAIT,
      {
        // m4
        protocol: Protocol.UninstallVirtualApp,
        protocolExecutionID: context.message.protocolExecutionID,
        seq: -1,
        toXpub: initiatingXpub,
        signature: s3,
        signature2: s2
      } as ProtocolMessage
    ];
    const { signature: s4 } = m5;

    const leftUninstallCommitment = await addLeftUninstallAgreementToContext(
      context.message.params,
      context,
      context.provider
    );

    validateSignature(initiatingAddress, leftUninstallCommitment, s4);

    const s5 = yield [Opcode.OP_SIGN, leftUninstallCommitment];

    // send m6 without waiting for a reply
    yield [
      Opcode.IO_SEND,
      {
        protocol: Protocol.UninstallVirtualApp,
        protocolExecutionID: context.message.protocolExecutionID,
        seq: -1,
        toXpub: initiatingXpub,
        signature: s5
      } as ProtocolMessage
    ];

    const rightUninstallCommitment = await addRightUninstallAgreementToContext(
      context.message.params,
      context,
      context.provider
    );

    const s6 = yield [Opcode.OP_SIGN, rightUninstallCommitment];

    const m8 = yield [
      Opcode.IO_SEND_AND_WAIT,
      {
        // m7
        protocol: Protocol.UninstallVirtualApp,
        protocolExecutionID: context.message.protocolExecutionID,
        seq: -1,
        toXpub: respondingXpub,
        signature: s6
      } as ProtocolMessage
    ];
    const { signature: s7 } = m8;

    validateSignature(respondingAddress, rightUninstallCommitment, s7);

    removeVirtualAppInstance(context.message.params, context);
  },

  2: async function*(context: Context) {
    const { initiatingXpub, intermediaryXpub } = context.message
      .params as UninstallVirtualAppParams;
    const initiatingAddress = xkeyKthAddress(initiatingXpub, 0);
    const intermediaryAddress = xkeyKthAddress(intermediaryXpub, 0);

    const lockCommitment = addVirtualAppStateTransitionToContext(
      context.message.params,
      context,
      false
    );

    const { signature: s1, signature2: s2 } = context.message;

    validateSignature(initiatingAddress, lockCommitment, s1);
    validateSignature(intermediaryAddress, lockCommitment, s2, true);

    const s3 = yield [Opcode.OP_SIGN, lockCommitment];

    const m7 = yield [
      Opcode.IO_SEND_AND_WAIT,
      {
        // m3
        protocol: Protocol.UninstallVirtualApp,
        protocolExecutionID: context.message.protocolExecutionID,
        seq: -1,
        toXpub: intermediaryXpub,
        signature: s3
      } as ProtocolMessage
    ];
    const { signature: s6 } = m7;

    const rightUninstallCommitment = await addRightUninstallAgreementToContext(
      context.message.params,
      context,
      context.provider
    );

    validateSignature(intermediaryAddress, rightUninstallCommitment, s6);

    const s7 = yield [Opcode.OP_SIGN, rightUninstallCommitment];

    yield [
      Opcode.IO_SEND,
      {
        protocol: Protocol.UninstallVirtualApp,
        protocolExecutionID: context.message.protocolExecutionID,
        seq: -1,
        toXpub: intermediaryXpub,
        signature: s7
      } as ProtocolMessage
    ];

    removeVirtualAppInstance(context.message.params, context);
  }
};

function removeVirtualAppInstance(
  params: ProtocolParameters,
  context: Context
) {
  const {
    intermediaryXpub,
    respondingXpub,
    initiatingXpub,
    targetAppIdentityHash
  } = params as UninstallVirtualAppParams;

  const key = virtualChannelKey(
    [initiatingXpub, respondingXpub],
    intermediaryXpub
  );

  const sc = context.stateChannelsMap.get(key)!;

  context.stateChannelsMap.set(key, sc.removeVirtualApp(targetAppIdentityHash));
}

function addVirtualAppStateTransitionToContext(
  params: ProtocolParameters,
  context: Context,
  isIntermediary: boolean
): VirtualAppSetStateCommitment {
  const {
    intermediaryXpub,
    respondingXpub,
    initiatingXpub,
    targetAppIdentityHash,
    targetAppState
  } = params as UninstallVirtualAppParams;

  const key = virtualChannelKey(
    [initiatingXpub, respondingXpub],
    intermediaryXpub
  );

  let sc = context.stateChannelsMap.get(key) as StateChannel;

  if (isIntermediary) {
    sc = sc.setState(targetAppIdentityHash, targetAppState);
  }

  sc = sc.lockAppInstance(targetAppIdentityHash);
  const targetAppInstance = sc.getAppInstance(targetAppIdentityHash);

  context.stateChannelsMap.set(key, sc);

  // post-expiry lock commitment
  return new VirtualAppSetStateCommitment(
    context.network,
    targetAppInstance.identity,
    targetAppInstance.defaultTimeout,
    targetAppInstance.hashOfLatestState,
    targetAppInstance.appSeqNo
  );
}

function constructUninstallOp(
  network: NetworkContext,
  stateChannel: StateChannel,
  seqNoToUninstall: number
) {
  const freeBalance = stateChannel.freeBalance;

  return new UninstallCommitment(
    network,
    stateChannel.multisigAddress,
    stateChannel.multisigOwners,
    freeBalance.identity,
    freeBalance.state as ETHBucketAppState,
    freeBalance.versionNumber,
    freeBalance.timeout,
    seqNoToUninstall
  );
}

async function addRightUninstallAgreementToContext(
  params: ProtocolParameters,
  context: Context,
  provider: BaseProvider
) {
  // uninstall right agreement
  const {
    initiatingXpub,
    intermediaryXpub,
    respondingXpub,
    targetAppIdentityHash
  } = params as UninstallVirtualAppParams;

  const key = virtualChannelKey(
    [initiatingXpub, respondingXpub],
    intermediaryXpub
  );

  const metachannel = context.stateChannelsMap.get(key) as StateChannel;

  const increments = await computeFreeBalanceIncrements(
    context.network,
    metachannel,
    targetAppIdentityHash,
    provider
  );

  const sc = getChannelFromCounterparty(
    context.stateChannelsMap,
    respondingXpub,
    intermediaryXpub
  )!;

  const agreementInstance = sc.getTwoPartyVirtualEthAsLumpFromTarget(
    targetAppIdentityHash
  );

  const newStateChannel = sc.uninstallTwoPartyVirtualEthAsLumpInstance(
    targetAppIdentityHash,
    {
      [zA(intermediaryXpub)]: increments[zA(initiatingXpub)],
      [zA(respondingXpub)]: increments[zA(respondingXpub)]
    }
  );

  context.stateChannelsMap.set(sc.multisigAddress, newStateChannel);

  return constructUninstallOp(context.network, sc, agreementInstance.appSeqNo);
}

async function addLeftUninstallAgreementToContext(
  params: ProtocolParameters,
  context: Context,
  provider: BaseProvider
): Promise<UninstallCommitment> {
  // uninstall left virtual app agreement

  const {
    initiatingXpub,
    intermediaryXpub,
    respondingXpub,
    targetAppIdentityHash
  } = params as UninstallVirtualAppParams;

  const key = virtualChannelKey(
    [initiatingXpub, respondingXpub],
    intermediaryXpub
  );

  const metachannel = context.stateChannelsMap.get(key) as StateChannel;

  const increments = await computeFreeBalanceIncrements(
    context.network,
    metachannel,
    targetAppIdentityHash,
    provider
  );

  const sc = getChannelFromCounterparty(
    context.stateChannelsMap,
    initiatingXpub,
    intermediaryXpub
  )!;

  const agreementInstance = sc.getTwoPartyVirtualEthAsLumpFromTarget(
    targetAppIdentityHash
  );

  const newStateChannel = sc.uninstallTwoPartyVirtualEthAsLumpInstance(
    targetAppIdentityHash,
    {
      [zA(intermediaryXpub)]: increments[zA(respondingXpub)],
      [zA(initiatingXpub)]: increments[zA(initiatingXpub)]
    }
  );

  context.stateChannelsMap.set(sc.multisigAddress, newStateChannel);

  return constructUninstallOp(context.network, sc, agreementInstance.appSeqNo);
}

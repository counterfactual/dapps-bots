import { StateChannel, xkeyKthAddress } from "@counterfactual/machine";
import {
  AssetType,
  Node,
  SolidityABIEncoderV2Struct
} from "@counterfactual/types";
import { AddressZero, MaxUint256, Zero } from "ethers/constants";
import { TransactionRequest } from "ethers/providers";
import { BigNumber, bigNumberify } from "ethers/utils";

import { RequestHandler } from "../../../request-handler";
import { NODE_EVENTS } from "../../../types";
import { getPeersAddressFromChannel } from "../../../utils";
import { ERRORS } from "../../errors";

export interface ETHBalanceRefundAppState extends SolidityABIEncoderV2Struct {
  recipient: string;
  multisig: string;
  threshold: BigNumber;
}

export async function installBalanceRefundApp(
  requestHandler: RequestHandler,
  params: Node.DepositParams
) {
  const {
    publicIdentifier,
    instructionExecutor,
    networkContext,
    store,
    provider
  } = requestHandler;

  const [peerAddress] = await getPeersAddressFromChannel(
    publicIdentifier,
    store,
    params.multisigAddress
  );

  const stateChannel = await store.getStateChannel(params.multisigAddress);

  const initialState: ETHBalanceRefundAppState = {
    recipient: xkeyKthAddress(publicIdentifier, 0),
    multisig: stateChannel.multisigAddress,
    threshold: await provider.getBalance(params.multisigAddress)
  };

  const stateChannelsMap = await instructionExecutor.runInstallProtocol(
    new Map<string, StateChannel>([
      // TODO: (architectural decision) Should this use `getAllChannels` or
      //       is this good enough? InstallProtocol only operates on a single
      //       channel, anyway. PR #532 might make this question obsolete.
      [stateChannel.multisigAddress, stateChannel]
    ]),
    {
      initialState,
      initiatingXpub: publicIdentifier,
      respondingXpub: peerAddress,
      multisigAddress: stateChannel.multisigAddress,
      aliceBalanceDecrement: Zero,
      bobBalanceDecrement: Zero,
      signingKeys: stateChannel.getNextSigningKeys(),
      terms: {
        // TODO: generalize
        assetType: AssetType.ETH,
        limit: MaxUint256,
        token: AddressZero
      },
      appInterface: {
        addr: networkContext.ETHBalanceRefund,
        stateEncoding:
          "tuple(address recipient, address multisig,  uint256 threshold)",
        actionEncoding: undefined
      },
      // this is the block-time equivalent of 7 days
      defaultTimeout: 1008
    }
  );

  await store.saveStateChannel(stateChannelsMap.get(params.multisigAddress)!);
}

export async function makeDeposit(
  requestHandler: RequestHandler,
  params: Node.DepositParams
): Promise<void> {
  const { multisigAddress, amount } = params;
  const { provider, blocksNeededForConfirmation, outgoing } = requestHandler;

  const tx: TransactionRequest = {
    to: multisigAddress,
    value: bigNumberify(amount),
    gasLimit: 30000,
    gasPrice: await provider.getGasPrice()
  };

  let txResponse;

  try {
    txResponse = await (await requestHandler.getSigner()).sendTransaction(tx);
  } catch (e) {
    if (e.toString().includes("reject")) {
      outgoing.emit(NODE_EVENTS.DEPOSIT_FAILED, e);
      console.error(`${ERRORS.DEPOSIT_FAILED}: ${e}`);
      return;
    }

    throw new Error(`${ERRORS.DEPOSIT_FAILED}: ${e}`);
  }

  outgoing.emit(NODE_EVENTS.DEPOSIT_STARTED, {
    value: amount,
    txHash: txResponse.hash
  });

  await provider.waitForTransaction(
    txResponse.hash as string,
    blocksNeededForConfirmation
  );
}

export async function uninstallBalanceRefundApp(
  requestHandler: RequestHandler,
  params: Node.DepositParams
) {
  const {
    publicIdentifier,
    store,
    instructionExecutor,
    networkContext
  } = requestHandler;

  const { ETHBalanceRefund } = networkContext;

  const [peerAddress] = await getPeersAddressFromChannel(
    publicIdentifier,
    store,
    params.multisigAddress
  );

  const stateChannel = await store.getStateChannel(params.multisigAddress);

  const refundApp = stateChannel.getAppInstanceOfKind(ETHBalanceRefund);

  const stateChannelsMap = await instructionExecutor.runUninstallProtocol(
    // https://github.com/counterfactual/monorepo/issues/747
    new Map<string, StateChannel>([
      [stateChannel.multisigAddress, stateChannel]
    ]),
    {
      initiatingXpub: publicIdentifier,
      respondingXpub: peerAddress,
      multisigAddress: stateChannel.multisigAddress,
      appIdentityHash: refundApp.identityHash
    }
  );

  await store.saveStateChannel(
    stateChannelsMap.get(stateChannel.multisigAddress)!
  );
}

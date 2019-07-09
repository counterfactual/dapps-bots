import ERC20 from "@counterfactual/contracts/build/ERC20.json";
import { Node } from "@counterfactual/types";
import { Contract } from "ethers";
import { BigNumber } from "ethers/utils";
import Queue from "p-queue";
import { jsonRpcMethod } from "rpc-server";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../../models/free-balance";
import { RequestHandler } from "../../../request-handler";
import { DepositConfirmationMessage, NODE_EVENTS } from "../../../types";
import { getPeersAddressFromChannel } from "../../../utils";
import { NodeController } from "../../controller";
import {
  CANNOT_DEPOSIT,
  FAILED_TO_GET_ERC20_BALANCE,
  INSUFFICIENT_ERC20_FUNDS,
  INSUFFICIENT_FUNDS
} from "../../errors";

import {
  installBalanceRefundApp,
  makeDeposit,
  uninstallBalanceRefundApp
} from "./operation";

export default class DepositController extends NodeController {
  public static readonly methodName = Node.MethodName.DEPOSIT;

  @jsonRpcMethod(Node.RpcMethodName.DEPOSIT)
  public executeMethod = super.executeMethod;

  protected async enqueueByShard(
    requestHandler: RequestHandler,
    params: Node.DepositParams
  ): Promise<Queue[]> {
    return [requestHandler.getShardedQueue(params.multisigAddress)];
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: Node.DepositParams
  ): Promise<void> {
    const { store, provider } = requestHandler;
    const { multisigAddress, amount } = params;

    params.tokenAddress = params.tokenAddress
      ? params.tokenAddress
      : CONVENTION_FOR_ETH_TOKEN_ADDRESS;

    const channel = await store.getStateChannel(multisigAddress);

    if (
      channel.hasAppInstanceOfKind(
        requestHandler.networkContext.CoinBalanceRefundApp
      )
    ) {
      throw new Error(`${CANNOT_DEPOSIT}`);
    }

    const address = await requestHandler.getSignerAddress();

    if (params.tokenAddress !== CONVENTION_FOR_ETH_TOKEN_ADDRESS) {
      const contract = new Contract(params.tokenAddress, ERC20.abi, provider);
      let balance: BigNumber;
      try {
        balance = await contract.functions.balanceOf(address);
      } catch (e) {
        throw new Error(
          FAILED_TO_GET_ERC20_BALANCE(params.tokenAddress, address)
        );
      }

      if (balance.lt(amount)) {
        throw new Error(
          `${INSUFFICIENT_ERC20_FUNDS(address, amount, balance)}`
        );
      }
    } else {
      const balanceOfSigner = await provider.getBalance(address);

      if (balanceOfSigner.lt(amount)) {
        throw new Error(`${INSUFFICIENT_FUNDS}: ${address}`);
      }
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: Node.DepositParams
  ): Promise<Node.DepositResult> {
    const {
      store,
      provider,
      messagingService,
      publicIdentifier,
      outgoing
    } = requestHandler;
    const { multisigAddress } = params;

    params.tokenAddress = params.tokenAddress
      ? params.tokenAddress
      : CONVENTION_FOR_ETH_TOKEN_ADDRESS;

    await installBalanceRefundApp(requestHandler, params);

    const depositSucceeded = await makeDeposit(requestHandler, params);

    await uninstallBalanceRefundApp(requestHandler, params);

    if (depositSucceeded) {
      if (params.notifyCounterparty) {
        const [peerAddress] = await getPeersAddressFromChannel(
          publicIdentifier,
          store,
          multisigAddress
        );

        await messagingService.send(peerAddress, {
          from: publicIdentifier,
          type: NODE_EVENTS.DEPOSIT_CONFIRMED,
          data: {
            ...params,
            // This party shouldn't get notified by the peer node
            notifyCounterparty: false
          }
        } as DepositConfirmationMessage);
      }

      outgoing.emit(NODE_EVENTS.DEPOSIT_CONFIRMED);
    }

    return {
      multisigBalance: await provider.getBalance(multisigAddress)
    };
  }
}

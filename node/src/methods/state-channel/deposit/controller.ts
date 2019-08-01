import ERC20 from "@counterfactual/cf-funding-protocol-contracts/build/ERC20.json";
import { Node } from "@counterfactual/types";
import { Contract } from "ethers";
import { BigNumber } from "ethers/utils";
import Queue from "p-queue";
import { jsonRpcMethod } from "rpc-server";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../../constants";
import { StateChannel } from "../../../models";
import { RequestHandler } from "../../../request-handler";
import { DepositConfirmationMessage, NODE_EVENTS } from "../../../types";
import { NodeController } from "../../controller";
import {
  CANNOT_DEPOSIT,
  FAILED_TO_GET_ERC20_BALANCE,
  INSUFFICIENT_ERC20_FUNDS_TO_DEPOSIT,
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
    const { store, provider, networkContext } = requestHandler;
    const { multisigAddress, amount, tokenAddress: tokenAddressParam } = params;

    const tokenAddress = tokenAddressParam || CONVENTION_FOR_ETH_TOKEN_ADDRESS;

    const channel = await store.getStateChannel(multisigAddress);

    if (channel.hasAppInstanceOfKind(networkContext.CoinBalanceRefundApp)) {
      throw new Error(CANNOT_DEPOSIT);
    }

    const address = await requestHandler.getSignerAddress();

    if (tokenAddress !== CONVENTION_FOR_ETH_TOKEN_ADDRESS) {
      const contract = new Contract(tokenAddress, ERC20.abi, provider);

      let balance: BigNumber;
      try {
        balance = await contract.functions.balanceOf(address);
      } catch (e) {
        throw new Error(FAILED_TO_GET_ERC20_BALANCE(tokenAddress, address));
      }

      if (balance.lt(amount)) {
        throw new Error(
          INSUFFICIENT_ERC20_FUNDS_TO_DEPOSIT(tokenAddress, amount, balance)
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
    const { provider } = requestHandler;
    const { multisigAddress, tokenAddress } = params;

    params.tokenAddress = tokenAddress || CONVENTION_FOR_ETH_TOKEN_ADDRESS;

    await installBalanceRefundApp(requestHandler, params);
    await makeDeposit(requestHandler, params);
    await uninstallBalanceRefundApp(requestHandler, params);

    // send deposit confirmation to counter party _after_ the balance refund
    // app is installed so as to prevent needing to handle the case of
    // the counter party hitting the issue of
    // "Cannot deposit while another deposit is occurring in the channel."
    const { messagingService, publicIdentifier, store } = requestHandler;
    const [counterpartyAddress] = await StateChannel.getPeersAddressFromChannel(
      publicIdentifier,
      store,
      multisigAddress
    );

    await messagingService.send(counterpartyAddress, {
      from: publicIdentifier,
      type: NODE_EVENTS.DEPOSIT_CONFIRMED,
      data: params
    } as DepositConfirmationMessage);

    return {
      multisigBalance: await provider.getBalance(multisigAddress)
    };
  }
}

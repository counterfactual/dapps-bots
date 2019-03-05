import { Node } from "@counterfactual/types";
import Queue from "p-queue";

import { RequestHandler } from "../../../request-handler";
import { DepositConfirmationMessage, NODE_EVENTS } from "../../../types";
import { getPeersAddressFromChannel } from "../../../utils";
import { NodeController } from "../../controller";
import { ERRORS } from "../../errors";

import {
  installBalanceRefundApp,
  makeDeposit,
  uninstallBalanceRefundApp
} from "./operation";

export default class DepositController extends NodeController {
  public static readonly methodName = Node.MethodName.DEPOSIT;

  protected async enqueueByShard(
    requestHandler: RequestHandler,
    params: Node.DepositParams
  ): Promise<Queue> {
    return requestHandler.getShardedQueue(params.multisigAddress);
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: Node.DepositParams
  ): Promise<void> {
    const { store, provider } = requestHandler;
    const { multisigAddress, amount } = params;

    const channel = await store.getStateChannel(multisigAddress);

    if (
      channel.hasAppInstanceOfKind(
        requestHandler.networkContext.ETHBalanceRefund
      )
    ) {
      return Promise.reject(ERRORS.CANNOT_DEPOSIT);
    }

    const balanceOfSigner = await provider.getBalance(
      await (await requestHandler.getSigner()).getAddress()
    );

    if (balanceOfSigner.lt(amount)) {
      return Promise.reject(ERRORS.INSUFFICIENT_FUNDS);
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: Node.DepositParams
  ): Promise<Node.DepositResult> {
    const { store } = requestHandler;
    const { multisigAddress } = params;

    const channel = await store.getStateChannel(multisigAddress);

    await installBalanceRefundApp(requestHandler, params);

    const beforeDepositMultisigBalance = await requestHandler.provider.getBalance(
      multisigAddress
    );

    await makeDeposit(requestHandler, params);

    const afterDepositMultisigBalance = await requestHandler.provider.getBalance(
      multisigAddress
    );

    await uninstallBalanceRefundApp(
      requestHandler,
      params,
      beforeDepositMultisigBalance,
      afterDepositMultisigBalance
    );
    if (
      channel.hasAppInstanceOfKind(
        requestHandler.networkContext.ETHBalanceRefund
      )
    ) {
      return Promise.reject(ERRORS.ETH_BALANCE_REFUND_NOT_UNINSTALLED);
    }

    if (params.notifyCounterparty) {
      const [peerAddress] = await getPeersAddressFromChannel(
        requestHandler.publicIdentifier,
        store,
        multisigAddress
      );

      await requestHandler.messagingService.send(peerAddress, {
        from: requestHandler.publicIdentifier,
        type: NODE_EVENTS.DEPOSIT_CONFIRMED,
        data: {
          ...params,
          // This party shouldn't get notified by the peer node
          notifyCounterparty: false
        }
      } as DepositConfirmationMessage);
    }

    requestHandler.outgoing.emit(NODE_EVENTS.DEPOSIT_CONFIRMED);

    return {
      multisigBalance: await requestHandler.provider.getBalance(multisigAddress)
    };
  }
}

import { Zero } from "ethers/constants";
import { Web3Provider } from "ethers/providers";
import { History } from "history";
import { Action } from "redux";
import { ThunkAction } from "redux-thunk";
import { RoutePath } from "../types";
import { forFunds, requestDeposit } from "../utils/counterfactual";
import { ActionType, ApplicationState, Deposit, StoreAction, WalletState } from "./types";

const { ethereum } = window;
const initialState = {
  ethAddress: "",
  error: {},
  counterfactualBalance: Zero,
  ethereumBalance: Zero
} as WalletState;

export const connectToWallet = (): ThunkAction<
  void,
  ApplicationState,
  null,
  Action<ActionType>
> => async dispatch => {
  try {
    await ethereum.enable();

    dispatch({
      data: {
        ethAddress: ethereum.selectedAddress
      } as WalletState,
      type: ActionType.WalletSetAddress
    });
  } catch (e) {
    dispatch({
      data: {
        error: {
          message:
            "You must allow Counterfactual to connect with Metamask in order to use it."
        }
      } as WalletState,
      type: ActionType.WalletError
    });
  }
};

export enum WalletDepositTransition {
  CheckWallet = "WALLET_DEPOSIT_CHECK_WALLET",
  WaitForFunds = "WALLET_DEPOSIT_WAITING_FOR_FUNDS"
}

export const deposit = (
  transaction: Deposit,
  provider: Web3Provider,
  history?: History
): ThunkAction<
  void,
  ApplicationState,
  null,
  Action<ActionType | WalletDepositTransition>
> => async dispatch => {
  try {
    // 1. Ask Metamask to do the deposit. !
    dispatch({ type: WalletDepositTransition.CheckWallet });
    await requestDeposit(transaction);

    // 2. Wait until the deposit is completed in both sides. !
    dispatch({ type: WalletDepositTransition.WaitForFunds });
    const counterfactualBalance = await forFunds({
      multisigAddress: transaction.multisigAddress,
      nodeAddress: transaction.nodeAddress
    });

    // 3. Get the Metamask balance.
    const ethereumBalance = await provider.getBalance(transaction.ethAddress);

    // 4. Update the balance.
    dispatch({
      data: { ethereumBalance, counterfactualBalance },
      type: ActionType.WalletSetBalance
    });

    // Optional: Redirect to Channels.
    if (history) {
      history.push(RoutePath.Channels);
    }
  } catch (e) {
    const error = e as Error;
    dispatch({
      data: {
        error: {
          message: `${error.message} because of ${error.stack}`
        }
      },
      type: ActionType.WalletError
    });
  }
};

export const reducers = function(
  state = initialState,
  action: StoreAction<WalletState, WalletDepositTransition>
) {
  switch (action.type) {
    case ActionType.WalletSetAddress:
    case ActionType.WalletSetBalance:
    case ActionType.WalletDeposit:
    case ActionType.WalletError:
      return {
        ...state,
        ...action.data,
        status: action.type
      };
    default:
      return {
        ...state,
        status: action.type
      };
  }
};

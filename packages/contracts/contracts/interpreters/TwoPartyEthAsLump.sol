pragma solidity 0.5.9;
pragma experimental "ABIEncoderV2";

import "../interfaces/Interpreter.sol";
import "../interfaces/TwoPartyFixedOutcome.sol";


contract TwoPartyEthAsLump is Interpreter {

  struct Params {
    address payable[2] playerAddrs;
    uint256 amount;
  }

  function interpretOutcomeAndExecuteEffect(
    bytes calldata encodedOutcome,
    bytes calldata encodedParams
  )
    external
  {

    Params memory params = abi.decode(encodedParams, (Params));

    TwoPartyFixedOutcome.Outcome outcome = abi.decode(
      encodedOutcome,
      (TwoPartyFixedOutcome.Outcome)
    );

    if (outcome == TwoPartyFixedOutcome.Outcome.SEND_TO_ADDR_ONE) {
      params.playerAddrs[0].transfer(params.amount);
      return;
    } else if (outcome == TwoPartyFixedOutcome.Outcome.SEND_TO_ADDR_TWO) {
      params.playerAddrs[1].transfer(params.amount);
      return;
    }

    /* SPLIT_AND_SEND_TO_BOTH_ADDRS or fallback case */

    params.playerAddrs[0].transfer(params.amount / 2);
    params.playerAddrs[1].transfer(params.amount - params.amount / 2);

    return;
  }
}
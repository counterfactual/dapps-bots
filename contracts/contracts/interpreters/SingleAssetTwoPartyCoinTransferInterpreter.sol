pragma solidity 0.5.10;
pragma experimental "ABIEncoderV2";

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

import "../libs/LibOutcome.sol";
import "../interfaces/Interpreter.sol";


/**
 * This file is excluded from ethlint/solium because of this issue:
 * https://github.com/duaraghav8/Ethlint/issues/261
 */
contract SingleAssetTwoPartyCoinTransferInterpreter is Interpreter {

  address constant CONVENTION_FOR_ETH_TOKEN_ADDRESS = address(0x0);

  struct Params {
    uint256 limit;
    address tokenAddress;
  }
  // NOTE: This is useful for writing tests, but is bad practice
  // to have in the contract when deploying it. We do not want people
  // to send funds to this contract in any scenario.
  function () external payable { }

  function interpretOutcomeAndExecuteEffect(
    bytes calldata encodedOutput,
    bytes calldata encodedParams
  )
    external
  {

    Params memory params = abi.decode(encodedParams, (Params));

    LibOutcome.CoinTransfer[2] memory outcome = abi.decode(
      encodedOutput,
      (LibOutcome.CoinTransfer[2])
    );

    if (params.tokenAddress == CONVENTION_FOR_ETH_TOKEN_ADDRESS) {
      outcome[0].to.transfer(outcome[0].amount);
      outcome[1].to.transfer(outcome[1].amount);
    } else {
      ERC20(params.tokenAddress).transfer(outcome[0].to, outcome[0].amount);
      ERC20(params.tokenAddress).transfer(outcome[1].to, outcome[1].amount);
    }

  }
}

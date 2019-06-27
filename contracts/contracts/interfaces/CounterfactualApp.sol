pragma solidity 0.5.10;
pragma experimental "ABIEncoderV2";


contract CounterfactualApp {

  function isStateTerminal(bytes calldata)
    external
    pure
    returns (bool)
  {
    revert("The isStateTerminal method has no implementation for this App");
  }

  function getTurnTaker(bytes calldata, address[] calldata)
    external
    pure
    returns (address)
  {
    revert("The getTurnTaker method has no implementation for this App");
  }

  function applyAction(bytes calldata, bytes calldata)
    external
    pure
    returns (bytes memory)
  {
    revert("The applyAction method has no implementation for this App");
  }

  function computeOutcome(bytes calldata)
    external
    pure
    returns (bytes memory)
  {
    revert("The computeOutcome method has no implementation for this App");
  }

}

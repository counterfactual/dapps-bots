pragma solidity 0.5.10;
pragma experimental "ABIEncoderV2";

import "./IdentityApp.sol";


contract FinalizedApp is IdentityApp {

  function isStateTerminal(bytes calldata)
    external
    pure
    returns (bool)
  {
    return true;
  }

}

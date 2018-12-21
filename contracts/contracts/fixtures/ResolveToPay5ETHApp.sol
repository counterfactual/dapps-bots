pragma solidity 0.4.25;
pragma experimental "ABIEncoderV2";

import "../lib/Transfer.sol";


/// @title ResolveToPay5ETHApp
/// @notice This contract is a test fixture meant to emulate an AppInstance
/// contract. An AppInstance has a getResolution() function that returns a
/// `Transfer.Transaction` object when the channel is closed.
contract ResolveToPay5ETHApp {

  function getResolution()
    public
    view
    returns (Transfer.Transaction)
  {
    uint256[] memory amounts = new uint256[](1);
    amounts[0] = 5 ether;

    address[] memory to = new address[](1);
    to[0] = address(0);

    bytes[] memory data;

    return Transfer.Transaction(
      0,
      address(0),
      to,
      amounts,
      data
    );
  }
}

pragma solidity 0.5;
pragma experimental "ABIEncoderV2";

import "../libs/Transfer.sol";


contract ETHBalanceRefundApp {

  struct AppState {
    address recipient;
    address multisig;
    uint256 threshold;
  }

  function resolve(AppState memory state, Transfer.Terms memory terms)
    public
    view
    returns (Transfer.Transaction memory)
  {
    uint256[] memory amounts = new uint256[](1);
    amounts[0] = address(state.multisig).balance - state.threshold;

    address[] memory to = new address[](1);
    to[0] = state.recipient;

    bytes[] memory data;

    return Transfer.Transaction(
      terms.assetType,
      terms.token,
      to,
      amounts,
      data
    );
  }
}
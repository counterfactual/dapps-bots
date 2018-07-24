pragma solidity 0.4.24;
pragma experimental "ABIEncoderV2";

import "@counterfactual/core/contracts/lib/Transfer.sol";


contract PaymentApp {

  struct AppState {
    address alice;
    address bob;
    uint256 aliceBalance;
    uint256 bobBalance;
  }

  function resolver(AppState state, Transfer.Terms terms)
    public
    pure
    returns (Transfer.Details)
  {
    uint256[] memory amounts = new uint256[](2);
    amounts[0] = state.aliceBalance;
    amounts[1] = state.bobBalance;

    address[] memory to = new address[](2);
    to[0] = state.alice;
    to[1] = state.bob;

    return Transfer.Details(
      terms.assetType,
      terms.token,
      to,
      amounts
    );
  }

}

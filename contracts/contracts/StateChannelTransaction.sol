pragma solidity 0.4.25;
pragma experimental "ABIEncoderV2";

import "./libs/Transfer.sol";
import "./libs/LibCondition.sol";

import "./ContractRegistry.sol";
import "./NonceRegistry.sol";
import "./AppRegistry.sol";


/// @title ConditionalTransaction - A conditional transfer contract
/// @author Liam Horne - <liam@l4v.io>
/// @author Mitchell Van Der Hoeff - <mitchell@l4v.io>
/// @notice Supports a complex transfer of funds contingent on some condition.
contract StateChannelTransaction is LibCondition {

  using Transfer for Transfer.Transaction;

  /// @notice Execute a fund transfer for a state channel app in a finalized state
  /// @param uninstallKey The key in the nonce registry
  /// @param appInstanceId AppInstanceId to be resolved
  /// @param terms The pre-agreed upon terms of the funds transfer
  function executeAppConditionalTransaction(
    AppRegistry appRegistry,
    NonceRegistry nonceRegistry,
    bytes32 uninstallKey,
    bytes32 appInstanceId,
    uint256 rootNonceExpectedValue,
    Transfer.Terms terms
  )
    public
  {
    require(
      nonceRegistry.isFinalizedOrHasNeverBeenSetBefore(
        // TODO: Allow ability to set timeout off-chain
        nonceRegistry.computeKey(address(this), 100, 0x0),
        rootNonceExpectedValue
      ),
      "Root nonce not finalized or finalized at an incorrect value"
    );

    require(
      !nonceRegistry.isFinalizedOrHasNeverBeenSetBefore(uninstallKey, 1),
      "App has been uninstalled"
    );

    require(
      appRegistry.isStateFinalized(appInstanceId),
      "App is not finalized yet"
    );

    Transfer.Transaction memory txn = appRegistry.getResolution(appInstanceId);

    require(
      Transfer.meetsTerms(txn, terms),
      "Transfer details do not meet terms"
    );

    txn.execute();
  }


}

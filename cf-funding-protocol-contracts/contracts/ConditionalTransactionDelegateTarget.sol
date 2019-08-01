pragma solidity 0.5.10;
pragma experimental "ABIEncoderV2";

/* solium-disable-next-line */
import "@counterfactual/cf-adjudicator-contracts/contracts/ChallengeRegistry.sol";

import "./libs/LibOutcome.sol";


/// @title ConditionalTransactionDelegateTarget
/// @author Liam Horne - <liam@l4v.io>
contract ConditionalTransactionDelegateTarget {

  address constant CONVENTION_FOR_ETH_TOKEN_ADDRESS = address(0x0);

  struct FreeBalanceAppState {
    address[] tokenAddresses;
    // The inner array contains the list of CoinTransfers for a single asset type
    // The outer array contains the list of asset balances for respecitve assets
    // according to the indexing used in the `tokens` array above
    LibOutcome.CoinTransfer[][] balances;
    bytes32[] activeApps;
  }

  function executeEffectOfFreeBalance(
    ChallengeRegistry challengeRegistry,
    bytes32 freeBalanceAppIdentityHash,
    address multiAssetMultiPartyCoinTransferInterpreterAddress,
    bytes memory multiAssetMultiPartyCoinTransferInterpreterParams
  )
    public
  {
    require(
      challengeRegistry.isStateFinalized(freeBalanceAppIdentityHash),
      "Free Balance app instance is not finalized yet"
    );

    LibOutcome.CoinTransfer[][] memory outcome = abi.decode(
      challengeRegistry.getOutcome(freeBalanceAppIdentityHash),
      (FreeBalanceAppState)
    ).balances;

    bytes memory payload = abi.encodeWithSignature(
      "interpretOutcomeAndExecuteEffect(bytes,bytes)",
      abi.encode(outcome),
      multiAssetMultiPartyCoinTransferInterpreterParams
    );

    (
      bool success,
      // solium-disable-next-line no-unused-vars
      bytes memory returnData
    ) = multiAssetMultiPartyCoinTransferInterpreterAddress.delegatecall(payload);

    require(
      success,
      "Execution of executeEffectOfFreeBalance failed"
    );
  }

  /// @notice Execute a fund transfer for a state channel app in a finalized state
  /// @param appIdentityHash AppIdentityHash to be resolved
  function executeEffectOfInterpretedAppOutcome(
    ChallengeRegistry challengeRegistry,
    bytes32 freeBalanceAppIdentityHash,
    bytes32 appIdentityHash,
    address interpreterAddress,
    bytes memory interpreterParams
  )
    public
  {

    bytes32[] memory activeApps = abi.decode(
      challengeRegistry.getOutcome(freeBalanceAppIdentityHash),
      (FreeBalanceAppState)
    ).activeApps;

    bool appIsFunded = false;

    for (uint256 i = 0; i < activeApps.length; i++) {
      if (activeApps[i] == appIdentityHash) {
        appIsFunded = true;
      }
    }

    require(appIsFunded, "Referenced AppInstance is not funded");

    bytes memory outcome = challengeRegistry.getOutcome(appIdentityHash);

    (
      bool success,
      // solium-disable-next-line no-unused-vars
      bytes memory returnData
    ) = interpreterAddress.delegatecall(
      abi.encodeWithSignature(
        "interpretOutcomeAndExecuteEffect(bytes,bytes)",
        outcome,
        interpreterParams
      )
    );

    require(
      success,
      "Execution of executeEffectOfInterpretedAppOutcome failed"
    );
  }

}

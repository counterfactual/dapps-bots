pragma solidity 0.5;
pragma experimental "ABIEncoderV2";

import "../libs/LibStateChannelApp.sol";

import "./MAppRegistryCore.sol";
import "./MAppCaller.sol";


contract MixinSetResolution is
  LibStateChannelApp,
  MAppRegistryCore,
  MAppCaller
{

  /// @notice Fetch and store the resolution of a state channel application
  // TODO: docs
  /// @param finalState The ABI encoded version of the finalized application state
  /// @param terms The ABI encoded version of the already agreed upon terms
  /// @dev Note this function is only callable when the state channel is in an OFF state
  function setResolution(
    AppIdentity memory appIdentity,
    AppInterface memory appInterface,
    bytes memory finalState,
    bytes memory terms
  )
    public
    doAppInterfaceCheck(appInterface, appIdentity.appInterfaceHash)
    doTermsCheck(terms, appIdentity.termsHash)
  {
    bytes32 id = computeAppIdentityHash(appIdentity);

    AppChallenge storage app = appStates[id];

    require(
      app.status == AppStatus.OFF ||
      (app.status == AppStatus.DISPUTE && block.number > app.finalizesAt),
      "setResolution called on an app either still ON or in DISPUTE"
    );

    require(
      keccak256(finalState) == app.appStateHash,
      "setResolution called with incorrect witness data of finalState"
    );

    appResolutions[id] = MAppCaller.resolve(appInterface, finalState, terms);
  }

}

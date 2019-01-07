pragma solidity 0.5;
pragma experimental "ABIEncoderV2";

import "../libs/LibStateChannelApp.sol";
import "../libs/LibSignature.sol";
import "../libs/LibStaticCall.sol";

import "./MAppRegistryCore.sol";
import "./MAppCaller.sol";


contract MixinSetStateWithAction is
  LibSignature,
  LibStateChannelApp,
  MAppRegistryCore,
  MAppCaller
{

  struct SignedStateUpdate {
    // NOTE: We include the full bytes of the state update,
    //       not just the hash of it as in MixinSetState.
    bytes encodedState;
    uint256 nonce;
    uint256 timeout;
    bytes signatures;
  }

  struct SignedAction {
    bytes encodedAction;
    bytes signature;
    bool checkForTerminal;
  }

  /// @notice Create a dispute regarding the latest signed state and immediately after,
  /// performs a unilateral action to update it.
  // @param app An `App` struct specifying the application logic
  // TODO: Docs
  /// @dev Note this function is only callable when the state channel is in an ON state
  function setStateWithAction(
    AppIdentity memory appIdentity,
    AppInterface memory appInterface,
    SignedStateUpdate memory req,
    SignedAction memory action
  )
    public
    doAppInterfaceCheck(appInterface, appIdentity.appInterfaceHash)
  {
    bytes32 identityHash = appIdentityToHash(appIdentity);

    AppChallenge storage challenge = appStates[identityHash];

    require(
      correctKeysSignedTheStateUpdate(identityHash, appIdentity.signingKeys, req),
      "Call to setStateWithAction included incorrectly signed state update"
    );

    require(
      challenge.status == AppStatus.ON,
      "setStateWithAction was called on an app that is either in DISPUTE or OFF"
    );

    require(
      req.nonce > challenge.nonce,
      "setStateWithAction was called with outdated state"
    );

    require(
      correctKeySignedTheAction(
        appInterface,
        appIdentity.signingKeys,
        challenge.disputeNonce,
        req,
        action
      ),
      "setStateWithAction called with action signed by incorrect turn taker"
    );

    bytes memory newState = MAppCaller.applyAction(
      appInterface,
      req.encodedState,
      action.encodedAction
    );

    if (action.checkForTerminal) {
      require(
        MAppCaller.isStateTerminal(appInterface, newState),
        "Attempted to claim non-terminal state was terminal in setStateWithAction"
      );
      challenge.finalizesAt = block.number;
      challenge.status = AppStatus.OFF;
    } else {
      challenge.finalizesAt = block.number + req.timeout;
      challenge.status = AppStatus.DISPUTE;
    }

    challenge.appStateHash = keccak256(newState);
    challenge.nonce = req.nonce;
    challenge.disputeNonce = 0;
    challenge.disputeCounter += 1;
    challenge.latestSubmitter = msg.sender;
  }

  function correctKeysSignedTheStateUpdate(
    bytes32 identityHash,
    address[] memory signingKeys,
    SignedStateUpdate memory req
  )
    private
    pure
    returns (bool)
  {
    bytes32 digest = computeStateHash(
      identityHash,
      keccak256(req.encodedState),
      req.nonce,
      req.timeout
    );
    return verifySignatures(req.signatures, digest, signingKeys);
  }

  function correctKeySignedTheAction(
    AppInterface memory appInterface,
    address[] memory signingKeys,
    uint256 disputeNonce,
    SignedStateUpdate memory req,
    SignedAction memory action
  )
    private
    view
    returns (bool)
  {
    address turnTaker = MAppCaller.getTurnTaker(
      appInterface,
      signingKeys,
      req.encodedState
    );

    address signer = recoverKey(
      action.signature,
      computeActionHash(
        turnTaker,
        keccak256(req.encodedState),
        action.encodedAction,
        req.nonce,
        disputeNonce
      ),
      0
    );

    return turnTaker == signer;
  }

}
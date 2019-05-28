pragma solidity 0.5.8;
pragma experimental "ABIEncoderV2";

import "../libs/LibStateChannelApp.sol";
import "../libs/LibSignature.sol";
import "../libs/LibStaticCall.sol";

import "./MChallengeRegistryCore.sol";


contract MixinSetState is
  LibSignature,
  LibStateChannelApp,
  MChallengeRegistryCore
{

  struct SignedAppChallengeUpdate {
    bytes32 appStateHash;
    uint256 nonce;
    uint256 timeout;
    bytes signatures;
  }

  /// @notice Set the instance state/AppChallenge to a given value.
  /// This value must have been signed off by all parties to the channel, that is,
  /// this must be called with the correct msg.sender (the state deposit holder)
  /// or signatures must be provided.
  /// @param appIdentity an AppIdentity struct with all information encoded within
  ///        it to represent which particular app is having state submitted
  /// @param req An object containing the update to be applied to the
  ///        applications state including the signatures of the users needed
  /// @dev This function is only callable when the state channel is not in challenge
  function setState(
    AppIdentity memory appIdentity,
    SignedAppChallengeUpdate memory req
  )
    public
  {
    bytes32 identityHash = appIdentityToHash(appIdentity);

    AppChallenge storage challenge = appChallenges[identityHash];

    require(
      challenge.status == ChallengeStatus.NO_CHALLENGE ||
      (
        challenge.status == ChallengeStatus.CHALLENGE_IS_OPEN &&
        challenge.finalizesAt >= block.number
      ),
      "setState was called on an app that has already been finalized"
    );

    if (msg.sender != appIdentity.owner) {
      require(
        correctKeysSignedAppChallengeUpdate(
          identityHash,
          appIdentity.signingKeys,
          req
        ),
        "Call to setState included incorrectly signed state update"
      );
    }

    require(
      req.nonce > challenge.nonce,
      "Tried to call setState with an outdated nonce version"
    );

    challenge.status = req.timeout > 0 ?
      ChallengeStatus.CHALLENGE_IS_OPEN :
      ChallengeStatus.CHALLENGE_WAS_FINALIZED;

    challenge.appStateHash = req.appStateHash;
    challenge.nonce = req.nonce;
    challenge.finalizesAt = block.number + req.timeout;
    challenge.challengeNonce = 0;
    challenge.challengeCounter += 1;
    challenge.latestSubmitter = msg.sender;
  }

  function correctKeysSignedAppChallengeUpdate(
    bytes32 identityHash,
    address[] memory signingKeys,
    SignedAppChallengeUpdate memory req
  )
    private
    pure
    returns (bool)
  {
    bytes32 digest = computeAppChallengeHash(
      identityHash,
      req.appStateHash,
      req.nonce,
      req.timeout
    );

    return verifySignatures(
      req.signatures,
      digest,
      signingKeys
    );
  }

}

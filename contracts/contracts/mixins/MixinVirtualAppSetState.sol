pragma solidity 0.5.10;
pragma experimental "ABIEncoderV2";

import "../libs/LibStateChannelApp.sol";
import "../libs/LibSignature.sol";
import "../libs/LibAppCaller.sol";

import "./MChallengeRegistryCore.sol";


contract MixinVirtualAppSetState is
  LibSignature,
  LibStateChannelApp,
  LibAppCaller,
  MChallengeRegistryCore
{

  /// signatures[0], instead of signing a message that authorizes
  /// a state update with a given stateHash, signs a message that authorizes all
  /// updates with versionNumber < versionNumberExpiry
  struct VirtualAppSignedAppChallengeUpdate {
    bytes32 appStateHash;
    uint256 versionNumber;
    uint256 timeout;
    bytes signatures;
    uint256 versionNumberExpiry;
  }

  function virtualAppSetState(
    AppIdentity memory appIdentity,
    VirtualAppSignedAppChallengeUpdate memory req
  )
    public
  {
    bytes32 identityHash = appIdentityToHash(appIdentity);

    AppChallenge storage challenge = appChallenges[identityHash];

    require(
      challenge.status == ChallengeStatus.NO_CHALLENGE,
      "setState can only be called on applications without any challenges on-chain"
    );

    require(
      correctKeysSignedAppChallengeUpdate(
        identityHash,
        appIdentity.signingKeys,
        req
      ),
      "Call to setState included incorrectly signed state update"
    );

    require(
      req.versionNumber > challenge.versionNumber,
      "Tried to call virtualAppSetState with an outdated versionNumber version"
    );

    require(
      req.versionNumber < req.versionNumberExpiry,
      "Tried to call virtualAppSetState with versionNumber greater than intermediary versionNumber expiry");

    challenge.status = req.timeout > 0 ?
      ChallengeStatus.FINALIZES_AFTER_DEADLINE :
      ChallengeStatus.EXPLICITLY_FINALIZED;

    challenge.appStateHash = req.appStateHash;
    challenge.versionNumber = req.versionNumber;
    challenge.finalizesAt = block.number + req.timeout;
    challenge.challengeCounter += 1;
    challenge.latestSubmitter = msg.sender;
  }

  function correctKeysSignedAppChallengeUpdate(
    bytes32 identityHash,
    address[] memory signingKeys,
    VirtualAppSignedAppChallengeUpdate memory req
  )
    private
    pure
    returns (bool)
  {
    bytes32 digest1 = computeAppChallengeHash(
      identityHash,
      req.appStateHash,
      req.versionNumber,
      req.timeout
    );

    bytes32 digest2 = keccak256(
      abi.encodePacked(
        byte(0x19),
        identityHash,
        req.versionNumberExpiry,
        req.timeout,
        byte(0x01)
      )
    );

    require(
      signingKeys[0] == recoverKey(req.signatures, digest2, 0), "Invalid signature"
    );

    address lastSigner = address(0);
    for (uint256 i = 1; i < signingKeys.length; i++) {
      require(
        signingKeys[i] == recoverKey(req.signatures, digest1, i), "Invalid signature"
      );

      require(signingKeys[i] > lastSigner, "Signers not in ascending order");

      lastSigner = signingKeys[i];
    }
    return true;
  }

}

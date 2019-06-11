pragma solidity 0.5.9;
pragma experimental "ABIEncoderV2";

import "@counterfactual/contracts/contracts/interfaces/CounterfactualApp.sol";
import "@counterfactual/contracts/contracts/interfaces/Interpreter.sol";
// solium-disable-next-line
import "@counterfactual/contracts/contracts/interfaces/TwoPartyFixedOutcome.sol";


/// @title High Roller App
/// @notice This contract allows the playing of a dice rolling game.
///         Two players take turns rolling two dice each.
///         The winner is the player whose sum of dice outcomes is highest.
/// @dev This contract is an example of a dApp built to run on
///      the CounterFactual framework
contract HighRollerApp is CounterfactualApp {

  enum ActionType {
    START_GAME,
    COMMIT_TO_HASH,
    COMMIT_TO_NUM,
    REVEAL
  }

  enum Stage {
    PRE_GAME,
    COMMITTING_HASH,
    COMMITTING_NUM,
    REVEALING,
    DONE
  }

  enum Player {
    FIRST,
    SECOND
  }

  struct AppState {
    Stage stage;
    bytes32 salt;
    bytes32 commitHash;
    uint256 playerFirstNumber;
    uint256 playerSecondNumber;
  }

  struct Action {
    ActionType actionType;
    uint256 number;
    bytes32 actionHash;
  }

  function isStateTerminal(bytes calldata encodedState)
    external
    pure
    returns (bool)
  {
    AppState memory appState = abi.decode(encodedState, (AppState));
    return appState.stage == Stage.DONE;
  }

  function getTurnTaker(
    bytes calldata encodedState, address[] calldata signingKeys
  )
    external
    pure
    returns (address)
  {
    AppState memory appState = abi.decode(encodedState, (AppState));

    return appState.stage == Stage.COMMITTING_NUM ?
      signingKeys[uint8(Player.SECOND)] :
      signingKeys[uint8(Player.FIRST)];
  }

  function applyAction(
    bytes calldata encodedState, bytes calldata encodedAction
  )
    external
    pure
    returns (bytes memory)
  {
    AppState memory appState = abi.decode(encodedState, (AppState));
    Action memory action = abi.decode(encodedAction, (Action));

    AppState memory nextState = appState;

    if (action.actionType == ActionType.START_GAME) {
      require(
        appState.stage == Stage.PRE_GAME,
        "Must apply START_GAME to PRE_GAME"
      );
      nextState.stage = Stage.COMMITTING_HASH;
    } else if (action.actionType == ActionType.COMMIT_TO_HASH) {
      require(
        appState.stage == Stage.COMMITTING_HASH,
        "Must apply COMMIT_TO_HASH to COMMITTING_HASH"
      );
      nextState.stage = Stage.COMMITTING_NUM;

      nextState.commitHash = action.actionHash;
    } else if (action.actionType == ActionType.COMMIT_TO_NUM) {
      require(
        appState.stage == Stage.COMMITTING_NUM,
        "Must apply COMMIT_TO_NUM to COMMITTING_NUM"
      );
      nextState.stage = Stage.REVEALING;

      nextState.playerSecondNumber = action.number;
    } else if (action.actionType == ActionType.REVEAL) {
      require(
        appState.stage == Stage.REVEALING,
        "Must apply REVEAL to REVEALING"
      );
      nextState.stage = Stage.DONE;

      nextState.playerFirstNumber = action.number;
      nextState.salt = action.actionHash;
    } else {
      revert("Invalid action type");
    }

    return abi.encode(nextState);
  }

  function computeOutcome(bytes calldata encodedState)
    external
    pure
    returns (bytes memory)
  {
    AppState memory appState = abi.decode(encodedState, (AppState));

    bytes32 expectedCommitHash = keccak256(
      abi.encodePacked(appState.salt, appState.playerFirstNumber)
    );
    if (expectedCommitHash == appState.commitHash) {
      return abi.encode(getWinningAmounts(
        appState.playerFirstNumber, appState.playerSecondNumber
      ));
    } else {
      return abi.encode(TwoPartyFixedOutcome.Outcome.SEND_TO_ADDR_TWO);
    }
  }

  function outcomeType()
    external
    pure
    returns (uint256)
  {
    return uint256(Interpreter.OutcomeType.TWO_PARTY_FIXED_OUTCOME);
  }

  function getWinningAmounts(uint256 num1, uint256 num2)
    internal
    pure
    returns (TwoPartyFixedOutcome.Outcome)
  {
    bytes32 randomSalt = calculateRandomSalt(num1, num2);
    (uint8 playerFirstTotal, uint8 playerSecondTotal) = highRoller(randomSalt);
    if (playerFirstTotal > playerSecondTotal) {
      return TwoPartyFixedOutcome.Outcome.SEND_TO_ADDR_ONE;
    } else if (playerFirstTotal < playerSecondTotal) {
      return TwoPartyFixedOutcome.Outcome.SEND_TO_ADDR_TWO;
    } else {
      return TwoPartyFixedOutcome.Outcome.SPLIT_AND_SEND_TO_BOTH_ADDRS;
    }
  }

  function highRoller(bytes32 randomness)
    internal
    pure
    returns(uint8 playerFirstTotal, uint8 playerSecondTotal)
  {
    (bytes8 hash1, bytes8 hash2,
    bytes8 hash3, bytes8 hash4) = cutBytes32(randomness);
    playerFirstTotal = bytes8toDiceRoll(hash1) + bytes8toDiceRoll(hash2);
    playerSecondTotal = bytes8toDiceRoll(hash3) + bytes8toDiceRoll(hash4);
  }

  function calculateRandomSalt(uint256 num1, uint256 num2)
    internal
    pure
    returns (bytes32)
  {
    require(
      num1 != 0 && num2 != 0,
      "Numbers passed in cannot equal 0"
      );
    return keccak256(abi.encodePacked(num1 * num2));
  }

  /// @notice Splits a bytes32 into 4 bytes8 by cutting every 8 bytes
  /// @param h The bytes32 to be split
  /// @dev Takes advantage of implicitly recognizing the length of each bytes8
  ///      variable when being read by `mload`. We point to the start of each
  ///      string (e.g., 0x08, 0x10) by incrementing by 8 bytes each time.
  function cutBytes32(bytes32 h)
    internal
    pure
    returns (bytes8 q1, bytes8 q2, bytes8 q3, bytes8 q4)
  {
    assembly {
      let ptr := mload(0x40)
      mstore(add(ptr, 0x00), h)
      q1 := mload(add(ptr, 0x00))
      q2 := mload(add(ptr, 0x08))
      q3 := mload(add(ptr, 0x10))
      q4 := mload(add(ptr, 0x18))
    }
  }

  /// @notice Converts a bytes8 into a uint64 between 1-6
  /// @param q The bytes8 to convert
  /// @dev Splits this by using modulo 6 to get the uint
  function bytes8toDiceRoll(bytes8 q)
    internal
    pure
    returns (uint8)
  {
    return uint8(uint64(q) % 6);
  }

}

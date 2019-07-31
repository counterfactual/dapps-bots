import { AppABIEncodings } from "@counterfactual/types";

export const tttAbiEncodings: AppABIEncodings = {
  stateEncoding: `
    tuple(
      uint256 versionNumber,
      uint256 winner,
      uint256[3][3] board
    )`,
  actionEncoding: `
    tuple(
      uint8 actionType,
      uint256 playX,
      uint256 playY,
      tuple(
        uint8 winClaimType,
        uint256 idx
      ) winClaim
    )"
  `
};

export const validAction = {
  actionType: 0,
  playX: 0,
  playY: 0,
  winClaim: {
    winClaimType: 0,
    idx: 0
  }
};

export function initialEmptyTTTState() {
  return {
    versionNumber: 0,
    winner: 0,
    board: [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  };
}

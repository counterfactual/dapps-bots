import { SolidityABIEncoderV2Struct } from "@counterfactual/types";
import chai from "chai";
import * as waffle from "ethereum-waffle";
import { Contract } from "ethers";
import { AddressZero } from "ethers/constants";
import { BigNumber, defaultAbiCoder } from "ethers/utils";

import NimApp from "../build/NimApp.json";

chai.use(waffle.solidity);

const { expect } = chai;

type NimSolidityABIEncoderV2Struct = {
  players: string[];
  turnNum: BigNumber;
  pileHeights: BigNumber[];
};

function decodeBytesToAppState(
  encodedAppState: string
): NimSolidityABIEncoderV2Struct {
  return defaultAbiCoder.decode(
    ["tuple(address[2] players, uint256 turnNum, uint256[3] pileHeights)"],
    encodedAppState
  )[0];
}

describe("Nim", () => {
  let nim: Contract;

  function encodeState(state: SolidityABIEncoderV2Struct) {
    return defaultAbiCoder.encode(
      [
        `
        tuple(
          address[2] players,
          uint256 turnNum,
          uint256[3] pileHeights
        )
      `
      ],
      [state]
    );
  }

  function encodeAction(state: SolidityABIEncoderV2Struct) {
    return defaultAbiCoder.encode(
      [
        `
        tuple(
          uint256 pileIdx,
          uint256 takeAmnt
        )
      `
      ],
      [state]
    );
  }

  async function applyAction(
    state: SolidityABIEncoderV2Struct,
    action: SolidityABIEncoderV2Struct
  ) {
    return await nim.functions.applyAction(
      encodeState(state),
      encodeAction(action)
    );
  }

  async function isStateTerminal(state: SolidityABIEncoderV2Struct) {
    return await nim.functions.isStateTerminal(encodeState(state));
  }

  before(async () => {
    const provider = waffle.createMockProvider();
    const wallet = (await waffle.getWallets(provider))[0];
    nim = await waffle.deployContract(wallet, NimApp);
  });

  describe("applyAction", () => {
    it("can take from a pile", async () => {
      const preState = {
        players: [AddressZero, AddressZero],
        turnNum: 0,
        pileHeights: [6, 5, 12]
      };

      const action = {
        pileIdx: 0,
        takeAmnt: 5
      };

      const ret = await applyAction(preState, action);

      const postState = decodeBytesToAppState(ret);

      expect(postState.pileHeights[0]).to.eq(1);
      expect(postState.pileHeights[1]).to.eq(5);
      expect(postState.pileHeights[2]).to.eq(12);
      expect(postState.turnNum).to.eq(1);
    });

    it("can take to produce an empty pile", async () => {
      const preState = {
        players: [AddressZero, AddressZero],
        turnNum: 0,
        pileHeights: [6, 5, 12]
      };

      const action = {
        pileIdx: 0,
        takeAmnt: 6
      };

      const ret = await applyAction(preState, action);

      const postState = decodeBytesToAppState(ret);

      expect(postState.pileHeights[0]).to.eq(0);
      expect(postState.pileHeights[1]).to.eq(5);
      expect(postState.pileHeights[2]).to.eq(12);
      expect(postState.turnNum).to.eq(1);
    });

    it("should fail for taking too much", async () => {
      const preState = {
        players: [AddressZero, AddressZero],
        turnNum: 0,
        pileHeights: [6, 5, 12]
      };

      const action = {
        pileIdx: 0,
        takeAmnt: 7
      };

      await expect(applyAction(preState, action)).to.be.revertedWith(
        "invalid pileIdx"
      );
    });
  });

  describe("isFinal", () => {
    it("empty state is final", async () => {
      const preState = {
        players: [AddressZero, AddressZero],
        turnNum: 49,
        pileHeights: [0, 0, 0]
      };
      expect(await isStateTerminal(preState)).to.eq(true);
    });

    it("nonempty state is not final", async () => {
      const preState = {
        players: [AddressZero, AddressZero],
        turnNum: 49,
        pileHeights: [0, 1, 0]
      };
      expect(await isStateTerminal(preState)).to.eq(false);
    });
  });
});

import * as ethers from "ethers";
import _ from "lodash";
import { NetworkContext } from "../../src/types";

export const EMPTY_NETWORK_CONTEXT = new NetworkContext(
  ethers.constants.AddressZero,
  ethers.constants.AddressZero,
  ethers.constants.AddressZero,
  ethers.constants.AddressZero,
  ethers.constants.AddressZero,
  ethers.constants.AddressZero,
  ethers.constants.AddressZero,
  ethers.constants.AddressZero
);

export async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function mineOneBlock(provider: ethers.providers.JsonRpcProvider) {
  return provider.send("evm_mine", []);
}

export async function mineBlocks(
  num: number,
  provider: ethers.providers.JsonRpcProvider
) {
  for (let i = 0; i < num; i++) {
    await mineOneBlock(provider);
  }
}

import { Contract, ContractFactory } from "ethers";
import { HashZero, One, Zero } from "ethers/constants";
import { JsonRpcSigner, Web3Provider } from "ethers/providers";
import { BigNumber, bigNumberify, solidityKeccak256 } from "ethers/utils";

import { expect } from "./utils";

const provider = new Web3Provider((global as any).web3.currentProvider);

contract("NonceRegistry", accounts => {
  let unlockedAccount: JsonRpcSigner;

  let nonceRegistry: Contract;

  const computeKey = (timeout: BigNumber, salt: string) =>
    solidityKeccak256(
      ["address", "uint256", "bytes32"],
      [accounts[0], timeout, salt]
    );

  before(async () => {
    unlockedAccount = await provider.getSigner(accounts[0]);

    const artifact = artifacts.require("NonceRegistry");

    nonceRegistry = await new ContractFactory(
      artifact.abi,
      artifact.bytecode,
      unlockedAccount
    ).deploy({ gasLimit: 6e9 });

    await nonceRegistry.deployed();
  });

  it("can set nonces", async () => {
    const timeout = bigNumberify(10);
    const salt = HashZero;
    const value = One;

    await nonceRegistry.functions.setNonce(timeout, salt, value);

    const ret = await nonceRegistry.functions.table(computeKey(timeout, salt));
    const blockNumber = bigNumberify(await provider.getBlockNumber());

    expect(ret.nonceValue).to.eq(One);
    expect(ret.finalizesAt).to.eq(blockNumber.add(timeout));
  });

  it("fails if nonce increment is not positive", async () => {
    const timeout = 10;
    const salt = HashZero;
    const value = 0; // By default, all values are set to 0

    const setNonce = nonceRegistry.functions.setNonce;

    // @ts-ignore
    await expect(setNonce(timeout, salt, value)).to.be.reverted;
  });

  it("can insta-finalize nonces", async () => {
    const timeout = Zero;
    const salt = HashZero;
    const value = One;
    const key = computeKey(timeout, salt);

    await nonceRegistry.functions.setNonce(timeout, salt, value);

    const ret = await nonceRegistry.functions.table(key);
    const isFinal = await nonceRegistry.functions.isFinalizedOrHasNeverBeenSetBefore(
      key,
      value
    );
    const blockNumber = bigNumberify(await provider.getBlockNumber());

    expect(ret.nonceValue).to.eq(value);
    expect(ret.finalizesAt).to.eq(blockNumber);
    expect(isFinal).to.be.true;
  });
});

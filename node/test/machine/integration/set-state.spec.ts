import ChallengeRegistry from "@counterfactual/contracts/build/ChallengeRegistry.json";
import { NetworkContext } from "@counterfactual/types";
import { Contract, Wallet } from "ethers";
import { AddressZero, WeiPerEther } from "ethers/constants";

import { SetStateCommitment } from "../../../src/ethereum";
import { xkeysToSortedKthSigningKeys } from "../../../src/machine";
import { StateChannel } from "../../../src/models";

import { toBeEq } from "./bignumber-jest-matcher";
import { connectToGanache } from "./connect-ganache";
import { getRandomHDNodes } from "./random-signing-keys";

// The ChallengeRegistry.setState call _could_ be estimated but we haven't
// written this test to do that yet
const SETSTATE_COMMITMENT_GAS = 6e9;

let wallet: Wallet;
let network: NetworkContext;
let appRegistry: Contract;

expect.extend({ toBeEq });

beforeAll(async () => {
  [{}, wallet, {}] = await connectToGanache();

  network = global["networkContext"];

  appRegistry = new Contract(
    network.ChallengeRegistry,
    ChallengeRegistry.abi,
    wallet
  );
});

/**
 * @summary Setup a StateChannel then set state on ETH Free Balance
 */
describe("set state on free balance", () => {
  it("should have the correct nonce", async done => {
    const xkeys = getRandomHDNodes(2);

    const multisigOwnerKeys = xkeysToSortedKthSigningKeys(
      xkeys.map(x => x.extendedKey),
      0
    );

    const stateChannel = StateChannel.setupChannel(
      network.ETHBucket,
      AddressZero,
      xkeys.map(x => x.neuter().extendedKey)
    ).setFreeBalance({
      [multisigOwnerKeys[0].address]: WeiPerEther,
      [multisigOwnerKeys[1].address]: WeiPerEther
    });

    const freeBalanceETH = stateChannel.getETHFreeBalance();

    const setStateCommitment = new SetStateCommitment(
      network,
      freeBalanceETH.identity,
      freeBalanceETH.hashOfLatestState,
      freeBalanceETH.nonce,
      freeBalanceETH.timeout
    );

    const setStateTx = setStateCommitment.transaction([
      multisigOwnerKeys[0].signDigest(setStateCommitment.hashToSign()),
      multisigOwnerKeys[1].signDigest(setStateCommitment.hashToSign())
    ]);

    await wallet.sendTransaction({
      ...setStateTx,
      gasLimit: SETSTATE_COMMITMENT_GAS
    });

    const contractAppState = await appRegistry.appChallenges(
      freeBalanceETH.identityHash
    );

    expect(contractAppState.nonce).toBeEq(setStateCommitment.appLocalNonce);

    done();
  });
});

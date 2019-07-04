import ChallengeRegistry from "@counterfactual/contracts/build/ChallengeRegistry.json";
import MultiSend from "@counterfactual/contracts/build/MultiSend.json";
import UninstallKeyRegistry from "@counterfactual/contracts/build/UninstallKeyRegistry.json";
import { AddressZero, HashZero, WeiPerEther, Zero } from "ethers/constants";
import {
  bigNumberify,
  defaultAbiCoder,
  getAddress,
  hexlify,
  Interface,
  keccak256,
  randomBytes,
  TransactionDescription
} from "ethers/utils";
import { fromSeed } from "ethers/utils/hdnode";

import { UninstallCommitment } from "../../../../src/ethereum";
import { MultisigTransaction } from "../../../../src/ethereum/types";
import { decodeMultisendCalldata } from "../../../../src/ethereum/utils/multisend-decoder";
import { StateChannel } from "../../../../src/models";
import { FreeBalanceState } from "../../../../src/models/free-balance";
import { generateRandomNetworkContext } from "../../mocks";

/**
 * This test suite decodes a constructed Uninstall Commitment transaction object
 * to the specifications defined by Counterfactual as can be found here:
 * https://specs.counterfactual.com/07-uninstall-protocol#commitments
 */
describe("Uninstall Commitment", () => {
  let tx: MultisigTransaction;

  // Dummy network context
  const networkContext = generateRandomNetworkContext();

  // General interaction testing values
  const interaction = {
    sender: fromSeed(hexlify(randomBytes(32))).neuter().extendedKey,
    receiver: fromSeed(hexlify(randomBytes(32))).neuter().extendedKey
  };

  // State channel testing values
  let stateChannel = StateChannel.setupChannel(
    networkContext.ETHBucket,
    getAddress(hexlify(randomBytes(20))),
    [interaction.sender, interaction.receiver]
  );

  // Set the state to some test values
  stateChannel = stateChannel.incrementFreeBalance(
    {
      [stateChannel.multisigOwners[0]]: WeiPerEther,
      [stateChannel.multisigOwners[1]]: WeiPerEther
    },
    AddressZero
  );

  const freeBalanceETH = stateChannel.freeBalance;

  const appBeingUninstalledSeqNo = Math.ceil(1000 * Math.random());

  beforeAll(() => {
    tx = new UninstallCommitment(
      networkContext,
      stateChannel.multisigAddress,
      stateChannel.multisigOwners,
      freeBalanceETH.identity,
      (freeBalanceETH.state as unknown) as FreeBalanceState,
      freeBalanceETH.versionNumber,
      freeBalanceETH.timeout,
      appBeingUninstalledSeqNo
    ).getTransactionDetails();
  });

  it("should be to MultiSend", () => {
    expect(tx.to).toBe(networkContext.MultiSend);
  });

  it("should have no value", () => {
    expect(tx.value).toBe(0);
  });

  describe("the calldata of the multisend transaction", () => {
    let transactions: [number, string, number, string][];

    beforeAll(() => {
      const { data } = tx;
      const desc = new Interface(MultiSend.abi).parseTransaction({ data });
      transactions = decodeMultisendCalldata(desc.args[0]);
    });

    it("should contain two transactions", () => {
      expect(transactions.length).toBe(2);
    });

    describe("the transaction to update the free balance", () => {
      let to: string;
      let val: number;
      let data: string;
      let op: number;

      beforeAll(() => {
        [op, to, val, data] = transactions[0];
      });

      it("should be to the ChallengeRegistry", () => {
        expect(to).toBe(networkContext.ChallengeRegistry);
      });

      it("should be of value 0", () => {
        expect(val).toEqual(Zero);
      });

      it("should be a Call", () => {
        expect(op).toBe(0);
      });

      describe("the calldata", () => {
        let iface: Interface;
        let calldata: TransactionDescription;

        beforeAll(() => {
          iface = new Interface(ChallengeRegistry.abi);
          calldata = iface.parseTransaction({ data });
        });

        it("should be directed at the setState method", () => {
          expect(calldata.sighash).toEqual(iface.functions.setState.sighash);
        });

        it("should build the expected AppIdentity argument", () => {
          const [
            [owner, signingKeys, appDefinition, defaultTimeout]
          ] = calldata.args;

          const expected = freeBalanceETH.identity;

          expect(owner).toBe(expected.owner);
          expect(signingKeys).toEqual(expected.signingKeys);
          expect(appDefinition).toBe(expected.appDefinition);
          expect(defaultTimeout).toEqual(bigNumberify(expected.defaultTimeout));
        });

        it("should build the expected SignedStateHashUpdate argument", () => {
          const [
            ,
            [stateHash, versionNumber, timeout, signatures]
          ] = calldata.args;

          expect(stateHash).toBe(freeBalanceETH.hashOfLatestState);
          expect(versionNumber).toEqual(
            bigNumberify(freeBalanceETH.versionNumber)
          );
          expect(timeout).toEqual(bigNumberify(freeBalanceETH.timeout));
          expect(signatures).toBe(HashZero);
        });
      });
    });

    describe("the transaction to update the dependency nonce", () => {
      let to: string;
      let val: number;
      let data: string;
      let op: number;

      beforeAll(() => {
        [op, to, val, data] = transactions[1];
      });

      it("should be to the UninstallKeyRegistry", () => {
        expect(to).toBe(networkContext.UninstallKeyRegistry);
      });

      it("should be of value 0", () => {
        expect(val).toEqual(Zero);
      });

      it("should be a Call", () => {
        expect(op).toBe(0);
      });

      describe("the calldata", () => {
        let iface: Interface;
        let calldata: TransactionDescription;

        beforeAll(() => {
          iface = new Interface(UninstallKeyRegistry.abi);
          iface = new Interface(UninstallKeyRegistry.abi);
          calldata = iface.parseTransaction({ data });
        });

        it("should be directed at the setKeyAsUninstalled method", () => {
          expect(calldata.sighash).toEqual(
            iface.functions.setKeyAsUninstalled.sighash
          );
        });

        it("should build set the key to uninstalled", () => {
          const [salt] = calldata.args;

          expect(salt).toEqual(
            keccak256(
              defaultAbiCoder.encode(["uint256"], [appBeingUninstalledSeqNo])
            )
          );
        });
      });
    });
  });
});

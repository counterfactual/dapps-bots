import ConditionalTransactionDelegateTarget from "@counterfactual/contracts/build/ConditionalTransactionDelegateTarget.json";
import { AddressZero, HashZero, WeiPerEther } from "ethers/constants";
import {
  getAddress,
  hexlify,
  Interface,
  randomBytes,
  TransactionDescription
} from "ethers/utils";
import { fromSeed } from "ethers/utils/hdnode";

import { ConditionalTransaction } from "../../../../src/ethereum";
import { MultisigTransaction } from "../../../../src/ethereum/types";
import { appIdentityToHash } from "../../../../src/ethereum/utils/app-identity";
import { StateChannel } from "../../../../src/models";
import { createFreeBalanceStateWithFundedETHAmounts } from "../../../integration/utils";
import { createAppInstance } from "../../../unit/utils";
import { generateRandomNetworkContext } from "../../mocks";

describe("ConditionalTransaction", () => {
  let tx: MultisigTransaction;

  // Test network context
  const networkContext = generateRandomNetworkContext();

  // General interaction testing values
  const interaction = {
    sender: fromSeed(hexlify(randomBytes(32))).neuter().extendedKey,
    receiver: fromSeed(hexlify(randomBytes(32))).neuter().extendedKey
  };

  // State channel testing values
  let stateChannel = StateChannel.setupChannel(
    networkContext.FreeBalanceApp,
    getAddress(hexlify(randomBytes(20))),
    [interaction.sender, interaction.receiver]
  );

  // Set the state to some test values
  stateChannel = stateChannel.setFreeBalance(
    createFreeBalanceStateWithFundedETHAmounts(
      stateChannel.multisigOwners,
      WeiPerEther
    )
  );

  const freeBalanceETH = stateChannel.freeBalance;

  const appInstance = createAppInstance(stateChannel);

  beforeAll(() => {
    tx = new ConditionalTransaction(
      networkContext,
      stateChannel.multisigAddress,
      stateChannel.multisigOwners,
      appInstance.identityHash,
      freeBalanceETH.identityHash,
      AddressZero,
      HashZero
    ).getTransactionDetails();
  });

  it("should be to the ConditionalTransactionDelegateTarget contract", () => {
    expect(tx.to).toBe(networkContext.ConditionalTransactionDelegateTarget);
  });

  it("should have no value", () => {
    expect(tx.value).toBe(0);
  });

  describe("the calldata", () => {
    let iface: Interface;
    let calldata: TransactionDescription;

    beforeAll(() => {
      iface = new Interface(ConditionalTransactionDelegateTarget.abi);
      calldata = iface.parseTransaction({ data: tx.data });
    });

    it("should be directed at the executeEffectOfInterpretedAppOutcome method", () => {
      expect(calldata.sighash).toBe(
        iface.functions.executeEffectOfInterpretedAppOutcome.sighash
      );
    });

    it("should have correctly constructed arguments", () => {
      const [
        appRegistryAddress,
        freeBalanceAppIdentity,
        appIdentityHash,
        interpreterAddress,
        interpreterParams
      ] = calldata.args;
      expect(appRegistryAddress).toBe(networkContext.ChallengeRegistry);
      expect(freeBalanceAppIdentity).toBe(freeBalanceETH.identityHash);
      expect(appIdentityHash).toBe(appIdentityToHash(appInstance.identity));
      expect(interpreterAddress).toBe(AddressZero);
      expect(interpreterParams).toBe(HashZero);
    });
  });
});

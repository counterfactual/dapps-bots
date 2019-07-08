import ChallengeRegistry from "@counterfactual/contracts/build/ChallengeRegistry.json";
import { AddressZero, HashZero, Zero } from "ethers/constants";
import {
  bigNumberify,
  getAddress,
  hexlify,
  Interface,
  keccak256,
  randomBytes,
  solidityPack,
  TransactionDescription
} from "ethers/utils";

import { VirtualAppSetStateCommitment } from "../../../../src/ethereum";
import { Transaction } from "../../../../src/ethereum/types";
import { appIdentityToHash } from "../../../../src/ethereum/utils/app-identity";
import { AppInstance } from "../../../../src/models";
import { generateRandomNetworkContext } from "../../mocks";

/**
 * This test suite decodes a constructed VirtualAppSetStateCommitment
 * transaction object defined here
 * https://specs.counterfactual.com/09-install-virtual-app-protocol#targetvirtualappsetstate
 */
describe("Virtual App Set State Commitment", () => {
  let commitment: VirtualAppSetStateCommitment;
  let tx: Transaction;

  const networkContext = generateRandomNetworkContext();

  const appInstance = new AppInstance(
    /* multisigAddress */ getAddress(hexlify(randomBytes(20))),
    /* signingKeys */ [
      getAddress(hexlify(randomBytes(20))),
      getAddress(hexlify(randomBytes(20)))
    ],
    /* defaultTimeout */ Math.ceil(1000 * Math.random()),
    /* appInterface */ {
      addr: getAddress(hexlify(randomBytes(20))),
      stateEncoding: "tuple(address foo, uint256 bar)",
      actionEncoding: undefined
    },
    /* isVirtualApp */ false,
    /* appSeqNo */ Math.ceil(1000 * Math.random()),
    { foo: AddressZero, bar: 0 },
    0,
    Math.ceil(1000 * Math.random()),
    {
      playerAddrs: [AddressZero, AddressZero],
      amount: Zero
    },
    undefined
  );

  beforeAll(() => {
    commitment = new VirtualAppSetStateCommitment(
      networkContext,
      appInstance.identity,
      appInstance.timeout,
      appInstance.hashOfLatestState,
      appInstance.versionNumber
    );
    tx = commitment.getSignedTransaction([], {
      r: HashZero,
      s: HashZero,
      v: 0
    });
  });

  it("should be to ChallengeRegistry", () => {
    expect(tx.to).toBe(networkContext.ChallengeRegistry);
  });

  it("should have no value", () => {
    expect(tx.value).toBe(0);
  });

  describe("the calldata", () => {
    const iface = new Interface(ChallengeRegistry.abi);
    let desc: TransactionDescription;

    beforeAll(() => {
      const { data } = tx;
      desc = iface.parseTransaction({ data });
    });

    it("should be to the virtualAppSetState method", () => {
      expect(desc.sighash).toBe(iface.functions.virtualAppSetState.sighash);
    });

    it("should contain expected AppIdentity argument", () => {
      const [owner, signingKeys, appDefinition, defaultTimeout] = desc.args[0];
      expect(owner).toBe(appInstance.identity.owner);
      expect(signingKeys).toEqual(appInstance.identity.signingKeys);
      expect(appDefinition).toBe(appInstance.identity.appDefinition);
      expect(defaultTimeout).toEqual(
        bigNumberify(appInstance.identity.defaultTimeout)
      );
    });

    it("should contain expected SignedStateHashUpdate argument", () => {
      const [stateHash, versionNumber, timeout, []] = desc.args[1];
      expect(stateHash).toBe(appInstance.hashOfLatestState);
      expect(versionNumber).toEqual(bigNumberify(appInstance.versionNumber));
      expect(timeout).toEqual(bigNumberify(appInstance.timeout));
    });
  });

  it("should produce the correct hash to sign", () => {
    const hashToSign = commitment.hashToSign(false);

    // Based on MChallengeRegistryCore::computeStateHash
    const expectedHashToSign = keccak256(
      solidityPack(
        ["bytes1", "bytes32", "uint256", "uint256", "bytes32"],
        [
          "0x19",
          appIdentityToHash(appInstance.identity),
          appInstance.versionNumber,
          appInstance.timeout,
          appInstance.hashOfLatestState
        ]
      )
    );

    expect(hashToSign).toBe(expectedHashToSign);
  });
});

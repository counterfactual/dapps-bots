import AppWithAction from "@counterfactual/contracts/build/AppWithAction.json";
import { NetworkContext } from "@counterfactual/types";
import { Contract, ContractFactory, Wallet } from "ethers";
import { AddressZero, Zero } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";
import { bigNumberify } from "ethers/utils";

import { xkeyKthAddress } from "../../../src/machine";
import { sortAddresses } from "../../../src/machine/xkeys";

import { toBeEq } from "./bignumber-jest-matcher";
import { connectToGanache } from "./connect-ganache";
import { makeNetworkContext } from "./make-network-context";
import { MessageRouter } from "./message-router";
import { MiniNode } from "./mininode";

let networkId: number;
let network: NetworkContext;
let provider: JsonRpcProvider;
let wallet: Wallet;
let appDefinition: Contract;

expect.extend({ toBeEq });

beforeAll(async () => {
  [provider, wallet, networkId] = await connectToGanache();

  network = makeNetworkContext(networkId);

  appDefinition = await new ContractFactory(
    AppWithAction.abi,
    AppWithAction.bytecode,
    wallet
  ).deploy();
});

describe("Three mininodes", () => {
  it("Can run all the protocols", async () => {
    const mininodeA = new MiniNode(network, provider);
    const mininodeB = new MiniNode(network, provider);
    const mininodeC = new MiniNode(network, provider);

    const mr = new MessageRouter([mininodeA, mininodeB, mininodeC]);

    mininodeA.scm = await mininodeA.ie.runSetupProtocol({
      initiatingXpub: mininodeA.xpub,
      respondingXpub: mininodeB.xpub,
      multisigAddress: AddressZero
    });

    // todo: if nodeB/nodeC is still busy doing stuff, we should wait for it

    mr.assertNoPending();

    const signingKeys = sortAddresses([
      xkeyKthAddress(mininodeA.xpub, 1),
      xkeyKthAddress(mininodeB.xpub, 1)
    ]);
    await mininodeA.ie.runInstallProtocol(mininodeA.scm, {
      signingKeys,
      initiatingXpub: mininodeA.xpub,
      respondingXpub: mininodeB.xpub,
      multisigAddress: AddressZero,
      initiatingBalanceDecrement: Zero,
      respondingBalanceDecrement: Zero,
      initialState: {
        player1: AddressZero,
        player2: AddressZero,
        counter: 0
      },
      appInterface: {
        addr: appDefinition.address,
        stateEncoding:
          "tuple(address player1, address player2, uint256 counter)",
        actionEncoding: "tuple(uint256 increment)"
      },
      defaultTimeout: 40
    });

    const appInstances = mininodeA.scm.get(AddressZero)!.appInstances;
    const [key] = [...appInstances.keys()].filter(key => {
      return (
        key !==
        mininodeA.scm.get(AddressZero)!.toJson().freeBalanceAppIndexes[0][1]
      );
    });

    await mininodeA.ie.runUninstallProtocol(mininodeA.scm, {
      appIdentityHash: key,
      initiatingXpub: mininodeA.xpub,
      respondingXpub: mininodeB.xpub,
      multisigAddress: AddressZero
    });

    mr.assertNoPending();

    const addressOne = "0x0000000000000000000000000000000000000001";

    mininodeB.scm.set(
      addressOne,
      (await mininodeB.ie.runSetupProtocol({
        initiatingXpub: mininodeB.xpub,
        respondingXpub: mininodeC.xpub,
        multisigAddress: "0x0000000000000000000000000000000000000001"
      })).get(addressOne)!
    );

    mr.assertNoPending();

    expect(mininodeA.scm.size).toBe(1);
    expect(mininodeB.scm.size).toBe(2);
    expect(mininodeC.scm.size).toBe(1);

    await mininodeA.ie.runInstallVirtualAppProtocol(mininodeA.scm, {
      initiatingXpub: mininodeA.xpub,
      intermediaryXpub: mininodeB.xpub,
      respondingXpub: mininodeC.xpub,
      defaultTimeout: 100,
      appInterface: {
        addr: appDefinition.address,
        stateEncoding:
          "tuple(address player1, address player2, uint256 counter)",
        actionEncoding: "tuple(uint256 increment)"
      },
      initialState: {
        player1: AddressZero,
        player2: AddressZero,
        counter: 0
      },
      initiatingBalanceDecrement: bigNumberify(0),
      respondingBalanceDecrement: bigNumberify(0)
    });

    expect(mininodeA.scm.size).toBe(2);

    const [virtualKey] = [...mininodeA.scm.keys()].filter(key => {
      return key !== AddressZero;
    });

    const [appInstance] = [
      ...mininodeA.scm.get(virtualKey)!.appInstances.values()
    ];

    expect(appInstance.isVirtualApp);

    await mininodeA.ie.runUpdateProtocol(mininodeA.scm, {
      initiatingXpub: mininodeA.xpub,
      respondingXpub: mininodeC.xpub,
      multisigAddress: virtualKey,
      appIdentityHash: appInstance.identityHash,
      newState: {
        player1: AddressZero,
        player2: AddressZero,
        counter: 1
      }
    });

    await mininodeA.ie.runTakeActionProtocol(mininodeA.scm, {
      initiatingXpub: mininodeA.xpub,
      respondingXpub: mininodeC.xpub,
      multisigAddress: virtualKey,
      appIdentityHash: appInstance.identityHash,
      action: {
        increment: 1
      }
    });

    await mininodeA.ie.runUninstallVirtualAppProtocol(mininodeA.scm, {
      initiatingXpub: mininodeA.xpub,
      intermediaryXpub: mininodeB.xpub,
      respondingXpub: mininodeC.xpub,
      targetAppIdentityHash: appInstance.identityHash,
      targetAppState: {
        player1: AddressZero,
        player2: AddressZero,
        counter: 2
      }
    });
  });
});

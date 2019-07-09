import AppWithAction from "@counterfactual/contracts/build/AppWithAction.json";
import { NetworkContext, OutcomeType } from "@counterfactual/types";
import { Contract, ContractFactory, Wallet } from "ethers";
import { Zero } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";
import { bigNumberify } from "ethers/utils";

import {
  computeUniqueIdentifierForStateChannelThatWrapsVirtualApp,
  xkeyKthAddress
} from "../../../src/machine";
import { sortAddresses } from "../../../src/machine/xkeys";
import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../../src/models/free-balance";
import { getCreate2MultisigAddress } from "../../../src/utils";

import { toBeEq } from "./bignumber-jest-matcher";
import { connectToGanache } from "./connect-ganache";
import { MessageRouter } from "./message-router";
import { MiniNode } from "./mininode";

let network: NetworkContext;
let provider: JsonRpcProvider;
let wallet: Wallet;
let appDefinition: Contract;

expect.extend({ toBeEq });

enum ActionType {
  SUBMIT_COUNTER_INCREMENT,
  ACCEPT_INCREMENT
}

beforeAll(async () => {
  [provider, wallet, {}] = await connectToGanache();
  network = global["networkContext"];

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

    const multisigAB = getCreate2MultisigAddress(
      [mininodeA.xpub, mininodeB.xpub],
      network.ProxyFactory,
      network.MinimumViableMultisig
    );

    const multisigBC = getCreate2MultisigAddress(
      [mininodeB.xpub, mininodeC.xpub],
      network.ProxyFactory,
      network.MinimumViableMultisig
    );

    const mr = new MessageRouter([mininodeA, mininodeB, mininodeC]);

    mininodeA.scm = await mininodeA.ie.runSetupProtocol({
      initiatingXpub: mininodeA.xpub,
      respondingXpub: mininodeB.xpub,
      multisigAddress: multisigAB
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
      multisigAddress: multisigAB,
      initiatingBalanceDecrement: Zero,
      respondingBalanceDecrement: Zero,
      initialState: {
        counter: 0
      },
      appInterface: {
        addr: appDefinition.address,
        stateEncoding: "tuple(uint256 counter)",
        actionEncoding: "tuple(uint8 actionType, uint256 increment)"
      },
      defaultTimeout: 40,
      outcomeType: OutcomeType.TWO_PARTY_FIXED_OUTCOME,
      tokenAddress: CONVENTION_FOR_ETH_TOKEN_ADDRESS
    });

    const appInstances = mininodeA.scm.get(multisigAB)!.appInstances;

    const [key] = [...appInstances.keys()].filter(key => {
      return key !== mininodeA.scm.get(multisigAB)!.freeBalance.identityHash;
    });

    await mininodeA.ie.runUninstallProtocol(mininodeA.scm, {
      appIdentityHash: key,
      initiatingXpub: mininodeA.xpub,
      respondingXpub: mininodeB.xpub,
      multisigAddress: multisigAB
    });

    mr.assertNoPending();

    mininodeB.scm.set(
      multisigBC,
      (await mininodeB.ie.runSetupProtocol({
        initiatingXpub: mininodeB.xpub,
        respondingXpub: mininodeC.xpub,
        multisigAddress: multisigBC
      })).get(multisigBC)!
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
        stateEncoding: "tuple(uint256 counter)",
        actionEncoding: "tuple(uint8 actionType, uint256 increment)"
      },
      initialState: {
        counter: 0
      },
      initiatingBalanceDecrement: bigNumberify(0),
      respondingBalanceDecrement: bigNumberify(0),
      tokenAddress: CONVENTION_FOR_ETH_TOKEN_ADDRESS
    });

    expect(mininodeA.scm.size).toBe(2);

    const unqiueIdentifierForStateChannelWrappingVirtualApp = computeUniqueIdentifierForStateChannelThatWrapsVirtualApp(
      [mininodeA.xpub, mininodeC.xpub],
      mininodeB.xpub
    );

    const [appInstance] = [
      ...mininodeA.scm
        .get(unqiueIdentifierForStateChannelWrappingVirtualApp)!
        .appInstances.values()
    ];

    expect(appInstance.isVirtualApp);

    await mininodeA.ie.runUpdateProtocol(mininodeA.scm, {
      initiatingXpub: mininodeA.xpub,
      respondingXpub: mininodeC.xpub,
      multisigAddress: unqiueIdentifierForStateChannelWrappingVirtualApp,
      appIdentityHash: appInstance.identityHash,
      newState: {
        counter: 1
      }
    });

    await mininodeA.ie.runTakeActionProtocol(mininodeA.scm, {
      initiatingXpub: mininodeA.xpub,
      respondingXpub: mininodeC.xpub,
      multisigAddress: unqiueIdentifierForStateChannelWrappingVirtualApp,
      appIdentityHash: appInstance.identityHash,
      action: {
        actionType: ActionType.SUBMIT_COUNTER_INCREMENT,
        increment: 1
      }
    });

    await mininodeA.ie.runUninstallVirtualAppProtocol(mininodeA.scm, {
      initiatingXpub: mininodeA.xpub,
      intermediaryXpub: mininodeB.xpub,
      respondingXpub: mininodeC.xpub,
      targetAppIdentityHash: appInstance.identityHash,
      targetAppState: {
        counter: 2
      }
    });
  });
});

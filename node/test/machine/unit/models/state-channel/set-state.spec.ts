import { AddressZero, Zero } from "ethers/constants";
import { getAddress, hexlify, randomBytes } from "ethers/utils";
import { fromSeed } from "ethers/utils/hdnode";

import { xkeyKthAddress } from "../../../../../src/machine";
import { AppInstance, StateChannel } from "../../../../../src/models";
import { createAppInstance } from "../../../../unit/utils";
import { generateRandomNetworkContext } from "../../../mocks";

const APP_STATE = {
  foo: AddressZero,
  bar: 42
};

describe("StateChannel::setState", () => {
  const networkContext = generateRandomNetworkContext();

  let sc1: StateChannel;
  let sc2: StateChannel;
  let testApp: AppInstance;

  beforeAll(() => {
    const multisigAddress = getAddress(hexlify(randomBytes(20)));
    const xpubs = [
      fromSeed(hexlify(randomBytes(32))).neuter().extendedKey,
      fromSeed(hexlify(randomBytes(32))).neuter().extendedKey
    ];

    sc1 = StateChannel.setupChannel(
      networkContext.ETHBucket,
      multisigAddress,
      xpubs
    );

    testApp = createAppInstance(sc1);

    sc1 = sc1.installApp(testApp, {
      [xkeyKthAddress(xpubs[0], 0)]: Zero,
      [xkeyKthAddress(xpubs[1], 0)]: Zero
    });
    sc2 = sc1.setState(testApp.identityHash, APP_STATE);
  });

  it("should not alter any of the base properties", () => {
    expect(sc2.multisigAddress).toBe(sc1.multisigAddress);
    expect(sc2.userNeuteredExtendedKeys).toBe(sc1.userNeuteredExtendedKeys);
  });

  it("should not have bumped the sequence number", () => {
    expect(sc2.numInstalledApps).toBe(sc1.numInstalledApps);
  });

  describe("the updated app", () => {
    let app: AppInstance;

    beforeAll(() => {
      app = sc2.getAppInstance(testApp.identityHash)!;
    });

    it("should have the new state", () => {
      expect(app.state).toEqual(APP_STATE);
    });

    it("should have bumped the versionNumber", () => {
      expect(app.versionNumber).toBe(testApp.versionNumber + 1);
    });

    it("should have used the default timeout", () => {
      expect(app.timeout).toBe(app.timeout);
    });
  });
});

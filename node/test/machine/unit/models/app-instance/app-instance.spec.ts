import { AddressZero, Zero } from "ethers/constants";
import { getAddress, hexlify, randomBytes } from "ethers/utils";

import { AppInstance } from "../../../../../src/models";

describe("AppInstance", () => {
  it("should be able to instantiate", () => {
    const multisigAddress = getAddress(hexlify(randomBytes(20)));
    const signingKeys = [
      getAddress(hexlify(randomBytes(20))),
      getAddress(hexlify(randomBytes(20)))
    ];

    const appInstance = new AppInstance(
      multisigAddress,
      signingKeys,
      Math.ceil(Math.random() * 2e10),
      {
        addr: getAddress(hexlify(randomBytes(20))),
        stateEncoding: "tuple(address foo, uint256 bar)",
        actionEncoding: undefined
      },
      false,
      Math.ceil(Math.random() * 2e10),
      0,
      { foo: getAddress(hexlify(randomBytes(20))), bar: 0 },
      999, // <------ versionNumber
      Math.ceil(1000 * Math.random()),
      {
        playerAddrs: [AddressZero, AddressZero],
        amount: Zero
      },
      undefined
    );

    expect(appInstance).not.toBe(null);
    expect(appInstance).not.toBe(undefined);
    expect(appInstance.multisigAddress).toBe(multisigAddress);
    expect(appInstance.signingKeys).toBe(signingKeys);

    // TODO: moar tests pl0x
  });
});

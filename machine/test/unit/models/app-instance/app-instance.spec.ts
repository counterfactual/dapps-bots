import { AssetType } from "@counterfactual/types";
import { AddressZero } from "ethers/constants";
import { bigNumberify, getAddress, hexlify, randomBytes } from "ethers/utils";

import { AppInstance } from "../../../../src/models";

describe("AppInstance", () => {
  it("should be able to instantiate", () => {
    const multisigAddress = getAddress(hexlify(randomBytes(20)));
    const signingKeys = [
      getAddress(hexlify(randomBytes(20))),
      getAddress(hexlify(randomBytes(20)))
    ];

    const app = new AppInstance(
      multisigAddress,
      signingKeys,
      Math.ceil(Math.random() * 2e10),
      {
        addr: getAddress(hexlify(randomBytes(20))),
        applyAction: hexlify(randomBytes(4)),
        resolve: hexlify(randomBytes(4)),
        isStateTerminal: hexlify(randomBytes(4)),
        getTurnTaker: hexlify(randomBytes(4)),
        stateEncoding: "tuple(address foo, uint256 bar)",
        actionEncoding: undefined
      },
      {
        assetType: AssetType.ETH,
        limit: bigNumberify(Math.ceil(Math.random() * 2e10)),
        token: AddressZero
      },
      false,
      Math.ceil(Math.random() * 2e10),
      { foo: getAddress(hexlify(randomBytes(20))), bar: 0 },
      999, // <------ nonce
      Math.ceil(1000 * Math.random())
    );

    expect(app).not.toBe(null);
    expect(app).not.toBe(undefined);
    expect(app.multisigAddress).toBe(multisigAddress);
    expect(app.signingKeys).toBe(signingKeys);

    // TODO: moar tests pl0x
  });
});

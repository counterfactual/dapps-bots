import { HashZero } from "ethers/constants";
import { hexlify, randomBytes, Signature, SigningKey } from "ethers/utils";

import { EthereumCommitment } from "../../../src/ethereum/types";
import { validateSignature } from "../../../src/protocol/utils/signature-validator";

describe("Signature Validator Helper", () => {
  let signer: SigningKey;
  let signature: Signature;
  let commitment: EthereumCommitment;

  beforeEach(() => {
    signer = new SigningKey(hexlify(randomBytes(32)));

    commitment = {
      hashToSign: () => HashZero
    } as EthereumCommitment;

    signature = signer.signDigest(commitment.hashToSign());
  });

  it("validates signatures correctly", () => {
    expect(() =>
      validateSignature(signer.address, commitment, signature)
    ).not.toThrow();
  });

  it("throws if signature is undefined", () => {
    expect(() =>
      validateSignature(signer.address, commitment, undefined)
    ).toThrow("validateSignature received an undefined signature");
  });

  it("throws if commitment is undefined", () => {
    expect(() =>
      validateSignature(signer.address, undefined, signature)
    ).toThrow("validateSignature received an undefined commitment");
  });

  it("throws if the signature is wrong", () => {
    expect(() =>
      validateSignature(
        signer.address,
        commitment,
        signer.signDigest(HashZero.replace("00", "11")) // 0x111111...
      )
    ).toThrow("Received invalid signature on validateSignature");
  });
});

import { Bytes32 } from "@counterfactual/types";
import {
  BigNumber,
  joinSignature,
  recoverAddress,
  Signature
} from "ethers/utils";

/**
 * Converts an array of signatures into a single string
 *
 * @param signatures An array of etherium signatures
 */
export function signaturesToBytes(...signatures: Signature[]): string {
  return signatures
    .map(joinSignature)
    .map(s => s.substr(2))
    .reduce((acc, v) => acc + v, "0x");
}

/**
 * Sorts signatures in ascending order of signer address
 *
 * @param signatures An array of etherium signatures
 */
export function sortSignaturesBySignerAddress(
  digest: string,
  signatures: Signature[]
): Signature[] {
  const ret = signatures.slice();
  ret.sort((sigA, sigB) => {
    const addrA = recoverAddress(digest, signaturesToBytes(sigA));
    const addrB = recoverAddress(digest, signaturesToBytes(sigB));
    return new BigNumber(addrA).lt(addrB) ? -1 : 1;
  });
  return ret;
}

/**
 * Sorts signatures in ascending order of signer address
 * and converts them into bytes
 *
 * @param signatures An array of etherium signatures
 */
export function signaturesToBytesSortedBySignerAddress(
  digest: Bytes32,
  ...signatures: Signature[]
): string {
  return signaturesToBytes(
    ...sortSignaturesBySignerAddress(digest, signatures)
  );
}

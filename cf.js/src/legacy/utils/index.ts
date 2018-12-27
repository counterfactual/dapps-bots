import { FreeBalance } from "./free-balance";
import { Nonce } from "./nonce";
import { CanonicalPeerBalance, PeerBalance } from "./peer-balance";
import * as serializer from "./serializer";

export { CanonicalPeerBalance, FreeBalance, Nonce, PeerBalance, serializer };

/**
 * Aliases to help code readability.
 * Byte arrays and addresses are represented as hex-encoded strings.
 * Should think about actually changing these to be non strings.
 */
export type Bytes = string; // dynamically-sized byte array
export type Bytes4 = string; // fixed-size byte arrays
export type Bytes32 = string;
export type Address = string; // ethereum address (i.e. rightmost 20 bytes of keccak256 of ECDSA pubkey)
export type H256 = string; // a bytes32 which is the output of the keccak256 hash function

import { hashMessage, joinSignature, SigningKey } from "ethers/utils";
import { fromMnemonic } from "ethers/utils/hdnode";
import { sign } from "jsonwebtoken";

function syncSignMessage(key: SigningKey, message: string) {
  return joinSignature(key.signDigest(hashMessage(message)));
}

function getNodeAddress(mnemonic: string) {
  return fromMnemonic(mnemonic)
    .derivePath("m/44'/60'/0'/25446")
    .neuter().extendedKey;
}

export const PK_ALICE =
  "0xe74ad40ac33d783e5775666ebbd28d0b395dbb4287bee0e88e1803df6eaa7ab4";

export const PK_ALICE_DUPE =
  "0x114ed1e994780a9d6decfc0915f43668f61b97fe8c37611152fc8b5e942b2dd5";

export const PK_BOB =
  "0x114ed1e994780a9d6decfc0915f43668f61b97fe8c37611152fc8b5e942b2dd5";

export const PK_CHARLIE =
  "0x4a138819ac516411432e76db794333eecd66e88926a528e621e31a97f5280c33";

export const USR_BOB_ID = "e5a48217-5d83-4fdd-bf1d-b9e35934f0f2";

export const USR_ALICE = (mnemonic: string) => {
  return {
    username: "alice_account3",
    email: "alice@wonderland.com",
    ethAddress: new SigningKey(PK_ALICE).address,
    nodeAddress: getNodeAddress(mnemonic)
  };
};

export const USR_ALICE_KNEX = (mnemonic: string) => {
  return {
    username: "alice_account3",
    email: "alice@wonderland.com",
    eth_address: new SigningKey(PK_ALICE).address,
    node_address: getNodeAddress(mnemonic)
  };
};

export const USR_ALICE_DUPLICATE_USERNAME = (mnemonic: string) => {
  const aliceUser = USR_ALICE(mnemonic);
  return {
    username: aliceUser.username,
    email: aliceUser.email,
    ethAddress: new SigningKey(PK_BOB).address,
    nodeAddress: getNodeAddress(mnemonic)
  };
};

export const USR_BOB = (mnemonic: string) => {
  return {
    username: "bob_account1",
    email: "bob@wonderland.com",
    ethAddress: new SigningKey(PK_BOB).address,
    multisigAddress: "0xc5F6047a22A5582f62dBcD278f1A2275ab39001A",
    nodeAddress: getNodeAddress(mnemonic)
  };
};

export const USR_BOB_KNEX = (mnemonic: string) => {
  return {
    id: USR_BOB_ID,
    email: "bob@wonderland.com",
    eth_address: new SigningKey(PK_BOB).address,
    multisig_address: "0xc5F6047a22A5582f62dBcD278f1A2275ab39001A",
    node_address: getNodeAddress(mnemonic),
    username: "bob_account1"
  };
};

export const USR_CHARLIE = (mnemonic: string) => {
  return {
    username: "charlie_account2",
    email: "charlie@wonderland.com",
    ethAddress: new SigningKey(PK_CHARLIE).address,
    nodeAddress: getNodeAddress(mnemonic)
  };
};

export const USR_CHARLIE_KNEX = (mnemonic: string) => {
  return {
    username: "charlie_account2",
    email: "charlie@wonderland.com",
    eth_address: new SigningKey(PK_CHARLIE).address,
    node_address: getNodeAddress(mnemonic)
  };
};

export const POST_USERS_ALICE = (mnemonic: string) => {
  return {
    data: {
      type: "user",
      attributes: { ...USR_ALICE(mnemonic) }
    }
  };
};

export const POST_USERS_ALICE_SIGNATURE_HEADER = (mnemonic: string) => {
  const userAlice = USR_ALICE(mnemonic);
  return {
    authorization: `Signature ${syncSignMessage(
      new SigningKey(PK_ALICE),
      [
        "PLAYGROUND ACCOUNT REGISTRATION",
        `Username: ${userAlice.username}`,
        `E-mail: ${userAlice.email}`,
        `Ethereum address: ${userAlice.ethAddress}`,
        `Node address: ${userAlice.nodeAddress}`
      ].join("\n")
    )}`
  };
};

export const POST_USERS_ALICE_NO_SIGNATURE = (mnemonic: string) => {
  return {
    data: {
      type: "user",
      attributes: { ...USR_ALICE(mnemonic) }
    }
  };
};

export const POST_USERS_ALICE_INVALID_SIGNATURE = (mnemonic: string) => {
  return POST_USERS_ALICE(mnemonic);
};

export const POST_USERS_ALICE_INVALID_SIGNATURE_HEADER = {
  authorization:
    "Signature 0xc157208c17b60bf325500914d0b4ddf57ee4c9c2ff1509e318c3d138a4ccb08b3258f9ac4e72d824fef67a40c3959e2f6480cdf6fbbf2590ea4a8bb17e7d5c980d"
};

export const POST_USERS_ALICE_DUPLICATE_USERNAME = (mnemonic: string) => {
  return {
    data: {
      type: "user",
      attributes: { ...USR_ALICE_DUPLICATE_USERNAME(mnemonic) }
    }
  };
};

export const POST_USERS_ALICE_DUPLICATE_USERNAME_SIGNATURE_HEADER = (
  mnemonic: string
) => {
  const userAliceDuplicate = USR_ALICE_DUPLICATE_USERNAME(mnemonic);
  return {
    authorization: `Signature ${syncSignMessage(
      new SigningKey(PK_ALICE_DUPE),
      [
        "PLAYGROUND ACCOUNT REGISTRATION",
        `Username: ${userAliceDuplicate.username}`,
        `E-mail: ${userAliceDuplicate.email}`,
        `Ethereum address: ${userAliceDuplicate.ethAddress}`,
        `Node address: ${userAliceDuplicate.nodeAddress}`
      ].join("\n")
    )}`
  };
};

export const POST_USERS_CHARLIE = (mnemonic: string) => {
  return {
    data: {
      type: "user",
      attributes: { ...USR_CHARLIE(mnemonic) }
    }
  };
};

export const POST_USERS_CHARLIE_SIGNATURE_HEADER = (mnemonic: string) => {
  const charlieUser = USR_CHARLIE(mnemonic);
  return {
    authorization: `Signature ${syncSignMessage(
      new SigningKey(PK_CHARLIE),
      [
        "PLAYGROUND ACCOUNT REGISTRATION",
        `Username: ${charlieUser.username}`,
        `E-mail: ${charlieUser.email}`,
        `Ethereum address: ${charlieUser.ethAddress}`,
        `Node address: ${charlieUser.nodeAddress}`
      ].join("\n")
    )}`
  };
};

export const POST_SESSION_CHARLIE = (mnemonic: string) => {
  const charlieUser = USR_CHARLIE(mnemonic);
  return {
    data: {
      type: "sessionRequest",
      attributes: { ethAddress: charlieUser.ethAddress }
    }
  };
};

export const POST_SESSION_CHARLIE_SIGNATURE_HEADER = (mnemonic: string) => {
  const charlieUser = USR_CHARLIE(mnemonic);
  return {
    authorization: `Signature ${syncSignMessage(
      new SigningKey(PK_CHARLIE),
      [
        "PLAYGROUND ACCOUNT LOGIN",
        `Ethereum address: ${charlieUser.ethAddress}`
      ].join("\n")
    )}`
  };
};

export const POST_SESSION_BOB = (mnemonic: string) => {
  const bobUser = USR_BOB(mnemonic);
  return {
    data: {
      type: "sessionRequest",
      attributes: { ethAddress: bobUser.ethAddress }
    }
  };
};

export const POST_SESSION_BOB_SIGNATURE_HEADER = (mnemonic: string) => {
  const bobUser = USR_BOB(mnemonic);
  return {
    authorization: `Signature ${syncSignMessage(
      new SigningKey(PK_BOB),
      [
        "PLAYGROUND ACCOUNT LOGIN",
        `Ethereum address: ${bobUser.ethAddress}`
      ].join("\n")
    )}`
  };
};

export const TOKEN_BOB = sign(
  {
    attributes: USR_BOB,
    id: USR_BOB_ID
  },
  "0x0123456789012345678901234567890123456789012345678901234567890123",
  { expiresIn: "1Y" }
);

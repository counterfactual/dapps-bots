import * as ethers from "ethers";

export const UNIT_ETH = ethers.utils.parseEther("1");
export const HIGH_GAS_LIMIT = { gasLimit: 6e9 };
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export const deployContract = async (
  contract: any,
  providerOrSigner: ethers.Wallet | ethers.providers.Provider,
  args?: any[]
): Promise<ethers.Contract> => {
  return new ethers.Contract("", contract.abi, providerOrSigner).deploy(
    contract.binary,
    ...(args || [])
  );
};

export const getDeployedContract = async (
  contract: any,
  providerOrSigner: ethers.Wallet | ethers.providers.Provider
): Promise<ethers.Contract> => {
  return new ethers.Contract(
    (await contract.deployed()).address,
    contract.abi,
    providerOrSigner
  );
};

export const randomETHAddress = (): string =>
  ethers.utils.hexlify(ethers.utils.randomBytes(20));

export function generateEthWallets(
  count: number,
  provider?: ethers.providers.Provider
): ethers.Wallet[] {
  const wallets: ethers.Wallet[] = [];
  for (let i = 0; i < count; i++) {
    let wallet = ethers.Wallet.createRandom();
    if (provider) {
      wallet = wallet.connect(provider); // @ts-ignore
    }
    wallets.push(wallet);
  }
  return wallets;
}

export const setupTestEnv = (web3: any) => {
  const provider = new ethers.providers.Web3Provider(web3.currentProvider);
  const unlockedAccount = new ethers.Wallet(
    process.env.npm_package_config_unlockedAccount!,
    provider
  );
  return { provider, unlockedAccount };
};

export function signMessageVRS(message, wallet): [number, string, string] {
  const signingKey = new ethers.utils.SigningKey(wallet.privateKey);
  const sig = signingKey.signDigest(message);
  if (typeof sig.recoveryParam === "undefined") {
    throw Error("Signature failed.");
  }
  return [sig.recoveryParam + 27, sig.r, sig.s];
}

export function signMessageBytes(message: string, wallet: ethers.Wallet) {
  const [v, r, s] = signMessageVRS(message, wallet);
  return (
    ethers.utils.hexlify(ethers.utils.padZeros(r, 32)).substring(2) +
    ethers.utils.hexlify(ethers.utils.padZeros(s, 32)).substring(2) +
    v.toString(16)
  );
}

export function signMessage(message, ...wallets: ethers.Wallet[]) {
  wallets.sort((a, b) => a.address.localeCompare(b.address));
  const signatures = wallets.map(w => signMessageBytes(message, w));
  return `0x${signatures.join("")}`;
}

export function getParamFromTxEvent(
  transaction,
  eventName,
  paramName,
  contract,
  contractFactory
) {
  let logs = transaction.logs;
  if (eventName != null) {
    logs = logs.filter(l => l.event === eventName && l.address === contract);
  }
  chai.assert.equal(logs.length, 1, "too many logs found!");
  const param = logs[0].args[paramName];
  if (contractFactory != null) {
    return contractFactory.at(param);
  } else {
    return param;
  }
}

export async function assertRejects(q, msg?) {
  let res;
  let catchFlag = false;
  try {
    res = await q;
  } catch (e) {
    catchFlag = true;
  } finally {
    if (!catchFlag) {
      chai.assert.fail(res, null, msg);
    }
  }
}

export const mineOneBlock = () => {
  // @ts-ignore
  const web3 = (global as any).web3;
  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync(
      {
        id: new Date().getTime(),
        jsonrpc: "2.0",
        method: "evm_mine",
        params: []
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      }
    );
  });
};

export const mineBlocks = async blocks => {
  for (let i = 0; i < blocks; i++) {
    await mineOneBlock();
  }
};

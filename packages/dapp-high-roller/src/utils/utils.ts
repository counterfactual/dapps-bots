import RopstenContracts from "@counterfactual/apps/networks/3.json";
import KovanContracts from "@counterfactual/apps/networks/42.json";

declare var ethereum;
declare var ethers;

function getProp(propertyName: string, context: { [key: string]: any }) {
  const state = context.history.location
    ? context.history.location.state || {}
    : {};
  const query = context.history.location
    ? context.history.location.query || {}
    : {};
  return state[propertyName] || query[propertyName] || context[propertyName];
}

/// Returns the commit hash that can be used to commit to chosenNumber
/// using appSalt
function computeCommitHash(appSalt: string, chosenNumber: number) {
  return ethers.utils.solidityKeccak256(
    ["bytes32", "uint256"],
    [appSalt, chosenNumber]
  );
}

function generateSalt() {
  return ethers.utils.bigNumberify(ethers.utils.randomBytes(32)).toHexString();
}

function getHighRollerContractAddress(): string {
  const networkVersion =
    ethereum && ethereum.networkVersion ? ethereum.networkVersion : "42";
  const contractName = "HighRollerApp";
  switch (networkVersion) {
    case "3":
      return getAddressFromNetwork(RopstenContracts, contractName);
    case "42":
      return getAddressFromNetwork(KovanContracts, contractName);
    default:
      throw new Error(
        `The App has not been deployed to network ID ${networkVersion}`
      );
  }
}

function getAddressFromNetwork(
  migrations: { address: string; contractName: string }[],
  contractName: string
): string {
  const appContract = migrations.find(
    migration => migration.contractName === contractName
  );
  if (!appContract) {
    throw new Error(
      `No contract address found for contractName: ${contractName}`
    );
  }
  return appContract.address;
}

export {
  getProp,
  computeCommitHash,
  generateSalt,
  getHighRollerContractAddress
};

const tdr = require("truffle-deploy-registry");

const HighRollerApp = artifacts.require("HighRollerApp");
const NimApp = artifacts.require("NimApp");
const TicTacToeApp = artifacts.require("TicTacToeApp");
const EthUnidirectionalPaymentApp = artifacts.require("EthUnidirectionalPaymentApp");

const ARTIFACTS = [
  HighRollerApp,
  NimApp,
  TicTacToeApp,
  EthUnidirectionalPaymentApp
];

module.exports = (deployer, network) => {
  deployer.then(async () => {
    for (const artifact of ARTIFACTS) {
      const instance = await deployer.deploy(artifact);
      if (!tdr.isDryRunNetworkName(network)) {
        await tdr.appendInstance(instance);
      }
    }
  });
};

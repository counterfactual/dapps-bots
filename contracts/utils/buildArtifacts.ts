import { AbstractContract } from "./contract";

export const ConditionalTransfer = AbstractContract.loadBuildArtifact(
  "ConditionalTransfer"
);
export const NonceRegistry = AbstractContract.loadBuildArtifact(
  "NonceRegistry"
);
export const Registry = AbstractContract.loadBuildArtifact("Registry");
export const StaticCall = AbstractContract.loadBuildArtifact("StaticCall");
export const Signatures = AbstractContract.loadBuildArtifact("Signatures");
export const Transfer = AbstractContract.loadBuildArtifact("Transfer");

export const AppInstance = AbstractContract.loadBuildArtifact("AppInstance", {
  StaticCall,
  Signatures,
  Transfer
});

export const MinimumViableMultisig = AbstractContract.loadBuildArtifact(
  "MinimumViableMultisig",
  {
    Signatures
  }
);

export default {
  ConditionalTransfer,
  NonceRegistry,
  Registry,
  StaticCall,
  MinimumViableMultisig,
  Signatures,
  Transfer,
  AppInstance
};

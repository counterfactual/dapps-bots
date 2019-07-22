export type AppIdentity = {
  owner: string;
  participants: string[];
  appDefinition: string;
  defaultTimeout: number;
};

export type AppInterface = {
  addr: string;
  stateEncoding: string;
  actionEncoding: string | undefined;
};

export type SignedStateHashUpdate = {
  appStateHash: string;
  versionNumber: number;
  timeout: number;
  signatures: string;
};

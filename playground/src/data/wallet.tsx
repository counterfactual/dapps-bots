import { createProviderConsumer } from "@stencil/state-tunnel";

export interface WalletState {
  signer?: Signer;
  provider?: Web3Provider;
  ethWeb3WalletBalance?: BigNumber;
  hasDetectedNetwork?: boolean;
  network?: string;
  connected?: boolean;
  web3Detected?: boolean;
  web3Enabled?: boolean;
  metamaskUnlocked?: boolean;
  networkPermitted?: boolean;
  updateWalletConnection?(data: Partial<WalletState>): Promise<void>;
  getEtherscanAddressURL?: (address: string) => string;
  getEtherscanTxURL?: (tx: string) => string;
}

export default createProviderConsumer<WalletState>({}, (subscribe, child) => (
  <context-consumer subscribe={subscribe} renderer={child} />
));

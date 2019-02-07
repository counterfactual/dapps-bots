// API matches version 0.20.3 of Web3

declare var web3: {
  BigNumber: (num: string) => void;
  eth: {
    accounts: [string];
    defaultBlock: number | string;
    getBalance: (
      address: string,
      defaultBlock?: number | string,
      callback?: (error: Error, balance: BigNumber) => void
    ) => void;
    sendTransaction: (
      transactionObject: {
        from: string | number;
        to?: string;
        value: number | string | BigNumber;
      },
      callback: (err: Error, result: any) => void
    ) => void;
  };
  personal: {
    sign: (
      dataToSign: string,
      from: string | number,
      callback: (err: Error, signedData: string) => void
    ) => void;
  };
  currentProvider: {
    enable: () => Promise<void>;
    selectedAddress: string;
  };
  version: {
    network: string;
  };
};

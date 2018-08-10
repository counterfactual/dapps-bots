import * as ethers from "ethers";
import { deployContract, HIGH_GAS_LIMIT, signMessageBytes } from "./utils";

const enum Operation {
  Call = 0,
  Delegatecall = 1
}

/**
 * Helper class for dealing with Multisignature wallets in tests.
 * Usage:
 * const multisig = new Multisig([alice.address, bob.address]);
 * await multisig.deploy(masterAccount);
 */
export class Multisig {
  private static loadTruffleContract() {
    const MinimumViableMultisig = artifacts.require("MinimumViableMultisig");
    const Signatures = artifacts.require("Signatures");
    MinimumViableMultisig.link("Signatures", Signatures.address);
    return MinimumViableMultisig;
  }

  private contract?: ethers.Contract;

  /**
   * Creates new undeployed Multisig instance
   * @param owners List of owner addresses
   */
  constructor(readonly owners: string[]) {}

  /**
   * Gets the on-chain address of the Multisig
   */
  get address() {
    if (!this.contract) {
      throw new Error("Must deploy Multisig contract first");
    }
    return this.contract.address;
  }

  /**
   * Deploy Multisig contract on-chain
   * @param signer The signer for the on-chain transaction
   */
  public async deploy(signer: ethers.ethers.Wallet) {
    const contract = await deployContract(
      Multisig.loadTruffleContract(),
      signer
    );
    await contract.functions.setup(this.owners);
    this.contract = contract;
  }

  /**
   * Execute delegatecall originating from Multisig contract
   * @param toContract Contract instance to send delegatecall to
   * @param funcName The name of the function to execute
   * @param args Arguments for the function call
   * @param signers The signers of the transaction
   */
  public async execDelegatecall(
    toContract: ethers.Contract,
    funcName: string,
    args: any[],
    signers: ethers.Wallet[]
  ): Promise<ethers.types.Transaction> {
    return this.execTransaction(
      toContract,
      funcName,
      args,
      Operation.Delegatecall,
      signers
    );
  }

  /**
   * Execute call originating from Multisig contract
   * @param toContract Contract instance to send call to
   * @param funcName The name of the function to execute
   * @param args Arguments for the function call
   * @param signers The signers of the transaction
   */
  public async execCall(
    toContract: ethers.Contract,
    funcName: string,
    args: any[],
    signers: ethers.Wallet[]
  ): Promise<ethers.types.Transaction> {
    return this.execTransaction(
      toContract,
      funcName,
      args,
      Operation.Call,
      signers
    );
  }

  private async execTransaction(
    toContract: ethers.Contract,
    funcName: string,
    args: any[],
    operation: Operation,
    wallets: ethers.Wallet[]
  ): Promise<ethers.types.Transaction> {
    if (!this.contract) {
      throw new Error("Must deploy Multisig contract first");
    }
    const value = 0;
    const calldata = toContract.interface.functions[funcName].encode(args);

    const transactionHash = await this.contract.functions.getTransactionHash(
      toContract.address,
      value,
      calldata,
      operation
    );

    // estimateGas() doesn't work well for delegatecalls, so need to hardcode gas limit
    const options = operation === Operation.Delegatecall ? HIGH_GAS_LIMIT : {};
    const signatures = signMessageBytes(transactionHash, wallets);
    return this.contract.functions.execTransaction(
      toContract.address,
      value,
      calldata,
      operation,
      signatures,
      options
    );
  }
}

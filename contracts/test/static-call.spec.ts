import { Contract, ContractFactory } from "ethers";
import { JsonRpcSigner, Web3Provider } from "ethers/providers";
import {
  defaultAbiCoder,
  hexlify,
  randomBytes,
  toUtf8Bytes
} from "ethers/utils";

import { expect } from "./utils";

const provider = new Web3Provider((global as any).web3.currentProvider);

contract("StaticCall", (accounts: string[]) => {
  let unlockedAccount: JsonRpcSigner;
  let testCaller: Contract;
  let echo: Contract;

  before(async () => {
    unlockedAccount = await provider.getSigner(accounts[0]);

    const testCallerArtifact = artifacts.require("TestCaller");
    testCallerArtifact.link(artifacts.require("LibStaticCall"));
    testCaller = await new ContractFactory(
      testCallerArtifact.abi,
      testCallerArtifact.binary,
      unlockedAccount
    ).deploy({ gasLimit: 6e9 });

    const echoArtifact = artifacts.require("Echo");
    echo = await new ContractFactory(
      echoArtifact.abi,
      echoArtifact.binary,
      unlockedAccount
    ).deploy({ gasLimit: 6e9 });

    await testCaller.deployed();
    await echo.deployed();
  });

  describe("execStaticCall", () => {
    const helloWorldString = hexlify(toUtf8Bytes("hello world"));

    it("retrieves bytes string from external pure function", async () => {
      const ret = await testCaller.functions.execStaticCall(
        echo.address,
        echo.interface.functions.helloWorld.sighash,
        "0x"
      );

      expect(ret).to.eq(helloWorldString);
    });

    it("retrieves true bool from external pure function", async () => {
      const ret = await testCaller.functions.execStaticCallBool(
        echo.address,
        echo.interface.functions.returnArg.sighash,
        defaultAbiCoder.encode(["bool"], [true])
      );
      expect(ret).to.be.true;
    });

    it("retrieves false bool from external pure function", async () => {
      const ret = await testCaller.functions.execStaticCallBool(
        echo.address,
        echo.interface.functions.returnArg.sighash,
        defaultAbiCoder.encode(["bool"], [false])
      );
      expect(ret).to.be.false;
    });

    it("retrieves argument from external pure function", async () => {
      const ret = await testCaller.functions.execStaticCall(
        echo.address,
        echo.interface.functions.helloWorldArg.sighash,
        defaultAbiCoder.encode(["string"], ["hello world"])
      );

      expect(ret).to.eq(helloWorldString);
    });

    it("fails to read msg.sender", async () => {
      await expect(
        testCaller.functions.execStaticCall(
          echo.address,
          echo.interface.functions.msgSender.sighash,
          "0x"
        )
        // @ts-ignore
      ).to.be.reverted;
    });

    it("reverts if the target is not a contract", async () => {
      await expect(
        testCaller.functions.execStaticCall(
          hexlify(randomBytes(20)),
          echo.interface.functions.helloWorld.sighash,
          "0x"
        )
        // @ts-ignore
      ).to.be.reverted;
    });
  });
});

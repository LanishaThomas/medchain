import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { defineConfig } from "hardhat/config";
import * as dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],

  solidity: {
    version: "0.8.28",
  },

  networks: {
    amoy: {
      type: "http",
      chainType: "l1",
      url: process.env.RPC_URL!,
      accounts: [process.env.PRIVATE_KEY!],
    },
  },
});
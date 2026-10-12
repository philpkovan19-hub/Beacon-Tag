require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PK = process.env.PRIVATE_KEY;
const accounts = PK ? [PK] : [];

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    hardhat: {},
    bohr: {
      url: process.env.BOHR_RPC || "https://rpc.bohr.life",
      chainId: 968,
      accounts,
    },
    botchain: {
      url: process.env.BOTCHAIN_RPC || "https://rpc.botchain.ai",
      chainId: 677,
      accounts,
    },
  },
};

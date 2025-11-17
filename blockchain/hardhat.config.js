require("dotenv").config();

require("@nomicfoundation/hardhat-toolbox");

const { RPC_URL, PRIVATE_KEY } = process.env;

module.exports = {
	solidity: "0.8.24",
	networks: {
		hardhat: {},
		localhost: {
			url: "http://127.0.0.1:8545",
			chainId: 31337, // Hardhat node default chain ID
		},
		ganache: {
			url: "http://127.0.0.1:8545",
			chainId: 1337, // Ganache default chain ID
			accounts: PRIVATE_KEY ? [PRIVATE_KEY] : undefined,
		},
		sepolia: {
			url: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
			chainId: 11155111,
			accounts: process.env.SEPOLIA_PRIVATE_KEY ? [process.env.SEPOLIA_PRIVATE_KEY] : undefined,
			gas: 6000000,
			gasPrice: 20000000000, // 20 gwei
		},
	},
	paths: {
		sources: "./contracts",
		tests: "./test",
		cache: "./cache",
		artifacts: "./artifacts",
	},
};

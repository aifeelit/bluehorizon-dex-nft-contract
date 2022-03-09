require('dotenv').config()
import { HardhatUserConfig } from 'hardhat/types'
import '@nomiclabs/hardhat-waffle'
import '@typechain/hardhat'
import 'hardhat-abi-exporter'
import '@nomiclabs/hardhat-etherscan'
import 'hardhat-gas-reporter'
import 'hardhat-deploy';
import "hardhat-deploy-ethers";

const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY || ''
const BLOCK_EXPLORER_API_KEY = process.env.BLOCK_EXPLORER_API_KEY || '' 

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  solidity: {
    compilers: [
      {
        version: '0.8.7',
        settings: {
          optimizer: {
            enabled: true,
            runs: 999999,
          }
        },
      },
      {
        version: '0.6.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 999999,
          }
        },
      },
      {
        version: '0.5.16',
        settings: {
          optimizer: {
            enabled: true,
            runs: 999999,
          }
        },
      },
    ],
  },
  networks: {
    hardhat: {},
    bscTestnet: {
      url: 'https://data-seed-prebsc-1-s1.binance.org:8545',
      chainId: 97,
      accounts: [OWNER_PRIVATE_KEY],
    },
    mainnet: {
      url: 'https://bsc-dataseed.binance.org',
      chainId: 56,
      accounts: [OWNER_PRIVATE_KEY],
    },
  },
  namedAccounts: {
    deployer: 0,
  },
  etherscan: {
    apiKey: BLOCK_EXPLORER_API_KEY,
  },
}

export default config

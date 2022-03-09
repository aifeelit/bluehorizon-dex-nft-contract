const HDWalletProvider = require('@truffle/hdwallet-provider')
const { mnemonic, BSCSCAN_API_KEY } = require('./env.json')

module.exports = {
  plugins: ['truffle-plugin-verify'],
  api_keys: {
    bscscan: BSCSCAN_API_KEY
  },
  networks: {
    mainnet: {
      provider: () => new HDWalletProvider(mnemonic, 'https://bsc-dataseed.binance.org/'),
      network_id: 56,
      timeoutBlocks: 200,
      confirmations: 5,
      production: true
    },
    bscTestnet: {
      provider: () => new HDWalletProvider(mnemonic, 'https://data-seed-prebsc-1-s1.binance.org:8545'),
      network_id: 97,
      timeoutBlocks: 200,
      confirmations: 5,
      production: true
    }
  },
  compilers: {
    solc: {
      version: '0.5.16',
      settings: {
        optimizer: {
          enabled: true,
          runs: 999999
        },
        evmVersion: 'istanbul'
      }
    }
  }
}

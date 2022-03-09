import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  const blh = await deployments.get('BlueHorizonToken')
  const provider = ethers.provider
  const rewardPerBlock = '578703703703703703'
  let startBlock = 10375290 // mainnet
  if (hre.network.name != 'mainnet') {
    startBlock = 11824747 // testnet
  }
  const bonusEndBlock = startBlock + 14 * 28800

  await deploy('MasterChef', {
    from: deployer,
    args: [blh.address, rewardPerBlock, startBlock, bonusEndBlock],
    log: true,
  })
}

export default func
func.tags = ['master', 'init']

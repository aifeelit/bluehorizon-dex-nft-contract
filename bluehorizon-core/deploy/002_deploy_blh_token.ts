import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()
  const TGE_TIME = 0

  if (hre.network.name == 'mainnet' && TGE_TIME == 0) {
    throw 'TGE time cannot be 0'
  }

  await deploy('BlueHorizonToken', {
    from: deployer,
    args: [TGE_TIME, deployer],
    log: true,
  })
}

export default func
func.tags = ['token', 'init']

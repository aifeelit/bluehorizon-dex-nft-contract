import { ethers } from 'hardhat'
const { BigNumber } = ethers

export async function advanceBlock() {
  return ethers.provider.send('evm_mine', [])
}

export async function advanceBlockTo(blockNumber: number) {
  for (let i = await ethers.provider.getBlockNumber(); i < blockNumber; i++) {
    await advanceBlock()
  }
}

export async function increase(value: number) {
  await ethers.provider.send('evm_increaseTime', [value])
  await advanceBlock()
}

export async function latest() {
  const block = await ethers.provider.getBlock('latest')
  return BigNumber.from(block.number)
}

export async function advanceTimeAndBlock(time: number) {
  await advanceTime(time)
  await advanceBlock()
}

export async function advanceTime(time: number) {
  await ethers.provider.send('evm_increaseTime', [time])
}

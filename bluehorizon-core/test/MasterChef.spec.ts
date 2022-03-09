import { ethers, waffle } from 'hardhat'
const { deployContract } = waffle
const { parseEther } = ethers.utils
import { MasterChef, BlueHorizonToken, MockERC20 } from '../typechain'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import BlueHorizonTokenArtifact from '../artifacts/contracts/BlueHorizonToken.sol/BlueHorizonToken.json'
import MasterChefArtifact from '../artifacts/contracts/MasterChef.sol/MasterChef.json'
import MockERC20Artifact from '../artifacts/contracts/test/MockERC20.sol/MockERC20.json'
import { expect } from './chai-setup'
import { advanceBlock, advanceBlockTo, latest, advanceTime } from './utils'

describe('MasterChef', () => {
  const INITIAL_SUPPLY = parseEther('25000000')

  before(async function () {
    const signers = await ethers.getSigners()
    this.alice = signers[0]
    this.bob = signers[1]
    this.carol = signers[2]
    this.owner = signers[3]
    this.minter = signers[4]
  })

  beforeEach(async function () {
    this.blh = (await deployContract(this.owner, BlueHorizonTokenArtifact, [0, this.owner.address])) as BlueHorizonToken
  })

  it('has correct settings', async function () {
    const master = (await deployContract(this.owner, MasterChefArtifact, [
      this.blh.address,
      1000,
      100,
      200,
    ])) as MasterChef

    await this.blh.setMaster(master.address)
    expect(await master.blh()).to.eq(this.blh.address)
    expect(await master.rewardPerBlock()).to.eq(1000)
    expect(await master.startBlock()).to.eq(100)
    expect(await master.bonusEndBlock()).to.eq(200)
    expect(await master.BONUS_MULTIPLIER()).to.eq(2)
    expect(await master.totalAllocPoint()).to.eq(0)
    expect(await master.poolLength()).to.eq(0)
  })

  describe('with LP tokens added', () => {
    beforeEach(async function () {
      this.lp = (await deployContract(this.minter, MockERC20Artifact, [
        'BLH/BNB',
        'BLH/BNB',
        '10000000000',
      ])) as MockERC20
      await this.lp.connect(this.minter).transfer(this.alice.address, '1000')
      await this.lp.connect(this.minter).transfer(this.bob.address, '1000')
      await this.lp.connect(this.minter).transfer(this.carol.address, '1000')
      this.lp2 = (await deployContract(this.minter, MockERC20Artifact, [
        'BUSD/BNB',
        'BUSD/BNB',
        '10000000000',
      ])) as MockERC20
      await this.lp2.connect(this.minter).transfer(this.alice.address, '1000')
      await this.lp2.connect(this.minter).transfer(this.bob.address, '1000')
      await this.lp2.connect(this.minter).transfer(this.carol.address, '1000')
    })

    it('adds new pools and sets pools correctly', async function () {
      const master = (await deployContract(this.owner, MasterChefArtifact, [
        this.blh.address,
        100,
        100,
        200,
      ])) as MasterChef
      await this.blh.setMaster(master.address)

      await expect(master.connect(this.alice).add('100', this.lp.address, true)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
      await expect(master.connect(this.alice).add('100', this.lp2.address, true)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )

      await master.add('1000', this.lp.address, true)
      expect((await master.poolInfo(0)).lpToken).to.eq(this.lp.address)
      expect((await master.poolInfo(0)).allocPoint).to.eq('1000')
      expect((await master.poolInfo(0)).lastRewardBlock).to.eq('100')
      expect((await master.poolInfo(0)).rewardPerShare).to.eq(0)
      expect(await master.poolId1(this.lp.address)).to.eq(1)
      await expect(master.add('1000', this.lp.address, true)).to.be.revertedWith(
        'MasterChef::add: lp is already in pool'
      )

      await master.add('400', this.lp2.address, true)
      expect((await master.poolInfo(1)).lpToken).to.eq(this.lp2.address)
      expect((await master.poolInfo(1)).allocPoint).to.eq('400')
      expect((await master.poolInfo(1)).lastRewardBlock).to.eq('100')
      expect((await master.poolInfo(1)).rewardPerShare).to.eq(0)
      expect(await master.poolId1(this.lp2.address)).to.eq(2)
      await expect(master.add('400', this.lp2.address, true)).to.be.revertedWith(
        'MasterChef::add: lp is already in pool'
      )
      expect(await master.totalAllocPoint()).to.eq('1400')
    })

    it('allows emergency withdraw', async function () {
      const master = (await deployContract(this.owner, MasterChefArtifact, [
        this.blh.address,
        100,
        100,
        200,
      ])) as MasterChef
      await this.blh.setMaster(master.address)

      await master.add('1000', this.lp.address, true)
      await this.lp.connect(this.bob).approve(master.address, '1000')
      await master.connect(this.bob).deposit(0, '100')
      expect(await this.lp.balanceOf(this.bob.address)).to.eq('900')
      await master.connect(this.bob).emergencyWithdraw(0)
      expect(await this.lp.balanceOf(this.bob.address)).to.eq('1000')
    })

    it('gives out rewards only after farming time', async function () {
      // 100 per block farming rate starting at block 50 with bonus until block 1000
      const startBlock = (await latest()).toNumber() + 50
      const master = (await deployContract(this.owner, MasterChefArtifact, [
        this.blh.address,
        100,
        startBlock,
        startBlock + 1000,
      ])) as MasterChef
      await this.blh.setMaster(master.address)

      await master.add('100', this.lp.address, true)

      await this.lp.connect(this.bob).approve(master.address, '1000')
      await master.connect(this.bob).deposit(0, '100')
      await advanceBlockTo(startBlock - 11) // block 39th

      await master.connect(this.bob).deposit(0, '0') // block 40th
      expect(await this.blh.balanceOf(this.bob.address)).to.eq('0')
      await advanceBlockTo(startBlock - 6)

      await master.connect(this.bob).deposit(0, '0') // block 45th
      expect(await this.blh.balanceOf(this.bob.address)).to.eq('0')
      await advanceBlockTo(startBlock - 1)

      await master.connect(this.bob).deposit(0, '0') // block 50th
      expect(await this.blh.balanceOf(this.bob.address)).to.eq('0')
      await advanceBlockTo(startBlock)

      await master.connect(this.bob).deposit(0, '0') // block 51th
      expect(await this.blh.balanceOf(this.bob.address)).to.eq('200')

      await advanceBlockTo(startBlock + 4)
      await master.connect(this.bob).deposit(0, '0') // block 55th
      expect(await this.blh.balanceOf(this.bob.address)).to.eq('1000')
      expect(await this.blh.totalSupply()).to.eq(INITIAL_SUPPLY.add(1000))
    })

    it('does not distribute reward if no one deposits', async function () {
      // 100 per block farming rate starting at block 50 with bonus until block 1000
      const startBlock = (await latest()).toNumber() + 50
      const master = (await deployContract(this.owner, MasterChefArtifact, [
        this.blh.address,
        100,
        startBlock,
        startBlock + 1000,
      ])) as MasterChef
      await this.blh.setMaster(master.address)

      await master.add('100', this.lp.address, true)
      await this.lp.connect(this.bob).approve(master.address, '1000')
      await advanceBlockTo(startBlock - 1)
      expect(await this.blh.totalSupply()).to.eq(INITIAL_SUPPLY)
      await advanceBlockTo(startBlock + 4)
      expect(await this.blh.totalSupply()).to.eq(INITIAL_SUPPLY)
      await advanceBlockTo(startBlock + 9)
      await master.connect(this.bob).deposit(0, '10') // block 60th
      expect(await this.blh.totalSupply()).to.eq(INITIAL_SUPPLY)
      expect(await this.blh.balanceOf(this.bob.address)).to.eq('0')
      expect(await this.lp.balanceOf(this.bob.address)).to.eq('990')
      await advanceBlockTo(startBlock + 19)
      await master.connect(this.bob).withdraw(0, '10') // block 70th
      expect(await this.blh.totalSupply()).to.eq(INITIAL_SUPPLY.add('2000'))
      expect(await this.blh.balanceOf(this.bob.address)).to.eq('2000')
      expect(await this.lp.balanceOf(this.bob.address)).to.eq('1000')
    })

    it('distributes reward properly for each staker', async function () {
      // 100 per block farming rate starting at block 50 with bonus until block 1000
      const startBlock = (await latest()).toNumber() + 50
      const master = (await deployContract(this.owner, MasterChefArtifact, [
        this.blh.address,
        100,
        startBlock,
        startBlock + 1000,
      ])) as MasterChef

      await this.blh.setMaster(master.address)
      await master.add('100', this.lp.address, true)
      await this.lp.connect(this.alice).approve(master.address, '1000')
      await this.lp.connect(this.bob).approve(master.address, '1000')
      await this.lp.connect(this.carol).approve(master.address, '1000')

      // Alice deposits 10 LPs at block 60
      await advanceBlockTo(startBlock + 9)
      await master.connect(this.alice).deposit(0, '10')
      // Bob deposits 20 LPs at block 64
      await advanceBlockTo(startBlock + 13)
      await master.connect(this.bob).deposit(0, '20')
      // Carol deposits 30 LPs at block 68
      await advanceBlockTo(startBlock + 17)
      await master.connect(this.carol).deposit(0, '30')
      // Alice deposits 10 more LPs at block 70. At this point:
      //   Alice should have: 4*200 + 4*1/3*200 + 2*1/6*200 = 1133
      //   MasterChef should have the remaining: 2000 - 1133 = 867
      await advanceBlockTo(startBlock + 19)
      await master.connect(this.alice).deposit(0, '10')
      expect(await this.blh.totalSupply()).to.eq(INITIAL_SUPPLY.add('2000'))
      expect(await this.blh.balanceOf(this.alice.address)).to.eq('1133')
      expect(await this.blh.balanceOf(this.bob.address)).to.eq('0')
      expect(await this.blh.balanceOf(this.carol.address)).to.eq('0')
      expect(await this.blh.balanceOf(master.address)).to.eq('867')
      // Bob withdraws 5 LPs at block 80. At this point:
      //   Bob should have: 4*2/3*200 + 2*2/6*200 + 10*2/7*200 = 1238
      //   MasterChef should have the remaining: 4000 - 1133 - 1238 = 1629
      await advanceBlockTo(startBlock + 19)
      await advanceBlockTo(startBlock + 29)
      await master.connect(this.bob).withdraw(0, '5')
      expect(await this.blh.totalSupply()).to.eq(INITIAL_SUPPLY.add('4000'))
      expect(await this.blh.balanceOf(this.alice.address)).to.eq('1133')
      expect(await this.blh.balanceOf(this.bob.address)).to.eq('1238')
      expect(await this.blh.balanceOf(this.carol.address)).to.eq('0')
      expect(await this.blh.balanceOf(master.address)).to.eq('1629')
      // Alice withdraws 20 LPs at block 90.
      // Bob withdraws 15 LPs at block 100.
      // Carol withdraws 30 LPs at block 110.
      await advanceBlockTo(startBlock + 39)
      await master.connect(this.alice).withdraw(0, '20')
      await advanceBlockTo(startBlock + 49)
      await master.connect(this.bob).withdraw(0, '15')
      await advanceBlockTo(startBlock + 59)
      await master.connect(this.carol).withdraw(0, '30')
      expect(await this.blh.totalSupply()).to.eq(INITIAL_SUPPLY.add('10000'))
      // Alice should have: 1133 + 10*2/7*200 + 10*2/6.5*200 = 2319
      expect(await this.blh.balanceOf(this.alice.address)).to.eq('2320')
      // Bob should have: 1238 + 10*1.5/6.5 * 200 + 10*1.5/4.5*200 = 2366
      expect(await this.blh.balanceOf(this.bob.address)).to.eq('2366')
      // Carol should have: 2*3/6*200 + 10*3/7*200 + 10*3/6.5*200 + 10*3/4.5*200 + 10*200 = 5314
      expect(await this.blh.balanceOf(this.carol.address)).to.eq('5314')
      // All of them should have 1000 LPs back.
      expect(await this.lp.balanceOf(this.alice.address)).to.eq('1000')
      expect(await this.lp.balanceOf(this.bob.address)).to.eq('1000')
      expect(await this.lp.balanceOf(this.carol.address)).to.eq('1000')
    })

    it('gives proper reward allocation to each pool', async function () {
      // 100 per block farming rate starting at block 50 with bonus until block 1000
      const startBlock = (await latest()).toNumber() + 50
      const master = (await deployContract(this.owner, MasterChefArtifact, [
        this.blh.address,
        100,
        startBlock,
        startBlock + 1000,
      ])) as MasterChef

      await this.blh.setMaster(master.address)

      await this.lp.connect(this.alice).approve(master.address, '1000')
      await this.lp2.connect(this.bob).approve(master.address, '1000')
      // Add first LP to the pool with allocation 1
      await master.add('10', this.lp.address, true)
      // Alice deposits 10 LPs at block 60th
      await advanceBlockTo(startBlock + 9)
      await master.connect(this.alice).deposit(0, '10')
      // Add LP2 to the pool with allocation 2 at block 70th
      await advanceBlockTo(startBlock + 19)
      await master.add('20', this.lp2.address, true)
      // Alice should have 10*200 pending reward
      expect(await master.pendingReward(0, this.alice.address)).to.equal('2000')
      // Bob deposits 10 LP2s at block 75th
      await advanceBlockTo(startBlock + 24)
      await master.connect(this.bob).deposit(1, '5')
      // Alice should have 2000 + 5*1/3*200 = 2333 pending reward
      expect(await master.pendingReward(0, this.alice.address)).to.equal('2333')
      await advanceBlockTo(startBlock + 30)
      // At block 80th. Bob should get 5*2/3*200 = 667 pending reward
      // Alice should have 2333 + 5*1/3*200 = 2666
      expect(await master.pendingReward(0, this.alice.address)).to.equal('2666')
      expect(await master.pendingReward(1, this.bob.address)).to.equal('666')
    })

    it('stops giving bonus reward after the bonus period ends', async function () {
      // 100 per block farming rate starting at block 50 with bonus until block 100
      const startBlock = (await latest()).toNumber() + 50
      const master = (await deployContract(this.owner, MasterChefArtifact, [
        this.blh.address,
        100,
        startBlock,
        startBlock + 100,
      ])) as MasterChef
      await this.blh.setMaster(master.address)

      await this.lp.connect(this.alice).approve(master.address, '1000', { from: this.alice.address })
      await master.add('1', this.lp.address, true)
      // Alice deposits 10 LPs at block 90
      await advanceBlockTo(startBlock + 89)
      await master.connect(this.alice).deposit(0, '10', { from: this.alice.address })
      // At block 105, she should have 200*10 + 100*5 = 2500 pending.
      await advanceBlockTo(startBlock + 105)
      expect(await master.pendingReward(0, this.alice.address)).to.equal('2500')
      // At block 106, Alice withdraws all pending rewards and should get 2600.
      await master.connect(this.alice).deposit(0, '0', { from: this.alice.address })
      expect(await master.pendingReward(0, this.alice.address)).to.equal('0')
      expect(await this.blh.balanceOf(this.alice.address)).to.equal('2600')
    })

    it('deposits correctly', async function () {
      // 100 per block farming rate starting at block 50 with bonus until block 100
      const startBlock = (await latest()).toNumber() + 50
      const master = (await deployContract(this.owner, MasterChefArtifact, [
        this.blh.address,
        100,
        startBlock,
        startBlock + 100,
      ])) as MasterChef
      await this.blh.setMaster(master.address)

      await master.add('100', this.lp.address, true)
      await this.lp.connect(this.bob).approve(master.address, '1000')

      await master.connect(this.bob).deposit(0, 100)
      expect(await this.lp.balanceOf(this.bob.address)).to.eq('900')
      expect(await this.lp.balanceOf(master.address)).to.eq('100')

      expect(await master.pendingReward(0, this.bob.address)).to.eq('0')
      expect((await master.userInfo(0, this.bob.address)).rewardDebt).to.eq('0')
      expect((await master.poolInfo(0)).rewardPerShare).to.eq('0')

      await this.lp.connect(this.carol).approve(master.address, '1000')
      await master.connect(this.carol).deposit(0, 50)
      expect(await this.lp.balanceOf(this.carol.address)).to.eq('950')
      expect(await this.lp.balanceOf(master.address)).to.eq('150')

      expect((await master.poolInfo(0)).rewardPerShare).to.eq('0')

      expect(await master.pendingReward(0, this.bob.address)).to.eq('0')
      expect(await master.pendingReward(0, this.carol.address)).to.eq('0')
    })

    it('limits the rewards monthly', async function () {
      // 30k BLH per block farming rate starting at block 50 with bonus until block 100
      const MONTH_IN_SECONDS = 30 * 86400
      const startBlock = (await latest()).toNumber() + 50
      this.blh = (await deployContract(this.owner, BlueHorizonTokenArtifact, [
        0,
        this.owner.address,
      ])) as BlueHorizonToken
      const master = (await deployContract(this.owner, MasterChefArtifact, [
        this.blh.address,
        parseEther('30000'),
        startBlock,
        startBlock + 100,
      ])) as MasterChef
      await this.blh.setMaster(master.address)

      await master.add('100', this.lp.address, true)

      await this.lp.connect(this.bob).approve(master.address, '1000')

      await advanceBlockTo(startBlock + 9)
      await master.connect(this.bob).deposit(0, 100)
      expect(await this.lp.balanceOf(this.bob.address)).to.eq('900')
      expect(await this.lp.balanceOf(master.address)).to.eq('100')

      await advanceBlockTo(startBlock + 19)
      await master.connect(this.bob).deposit(0, 0)
      expect(await this.blh.balanceOf(this.bob.address)).to.eq(parseEther('600000'))
      expect(await this.blh.balanceOf(master.address)).to.eq(0)

      await advanceBlockTo(startBlock + 79)
      expect(await this.blh.balanceOf(this.bob.address)).to.eq(parseEther('600000'))
      expect(await this.blh.balanceOf(master.address)).to.eq(0)
      expect(await master.pendingReward(0, this.bob.address)).to.eq(parseEther('2733333.333333333333333333'))
      await master.connect(this.bob).deposit(0, 0)
      expect(await this.blh.balanceOf(this.bob.address)).to.eq(parseEther('3333333.333333333333333333'))
      expect(await this.blh.balanceOf(master.address)).to.eq(0)

      await advanceBlockTo(startBlock + 99)
      expect(await this.blh.balanceOf(this.bob.address)).to.eq(parseEther('3333333.333333333333333333'))
      expect(await this.blh.balanceOf(master.address)).to.eq(0)
      expect(await master.pendingReward(0, this.bob.address)).to.eq(0)
      await master.connect(this.bob).deposit(0, 0)
      expect(await this.blh.balanceOf(this.bob.address)).to.eq(parseEther('3333333.333333333333333333'))
      expect(await this.blh.balanceOf(master.address)).to.eq(0)

      await advanceBlockTo(startBlock + 108)
      expect(await master.pendingReward(0, this.bob.address)).to.eq(0)
      await advanceTime(MONTH_IN_SECONDS)
      await advanceBlock()
      expect(await this.blh.balanceOf(this.bob.address)).to.eq(parseEther('3333333.333333333333333333'))
      expect(await this.blh.balanceOf(master.address)).to.eq(0)
      expect(await master.pendingReward(0, this.bob.address)).to.eq(parseEther('270000'))
      await master.connect(this.bob).deposit(0, 0)
      expect(await this.blh.balanceOf(this.bob.address)).to.eq(parseEther('3633333.333333333333333333'))
      expect(await this.blh.balanceOf(master.address)).to.eq(0)
    })
  })
})

import { ethers, waffle } from 'hardhat'
const { deployContract } = waffle
const { parseEther } = ethers.utils
import { BlueHorizonToken } from '../typechain'
import BlueHorizonTokenArtifact from '../artifacts/contracts/BlueHorizonToken.sol/BlueHorizonToken.json'
import { expect } from './chai-setup'
import { increase } from './utils'

describe('BlueHorizonToken', () => {
  const MONTH_IN_SECONDS = 30 * 86400
  const FARMING = parseEther('40000000')

  before(async function () {
    const signers = await ethers.getSigners()
    this.alice = signers[0]
    this.bob = signers[1]
    this.carol = signers[2]
    this.owner = signers[3]
    this.master = signers[4]
    this.nftMaster = signers[5]
    this.team = signers[6]
    this.advisor = signers[7]
    this.fund = signers[8]
  })

  beforeEach(async function () {
    this.blh = (await deployContract(this.owner, BlueHorizonTokenArtifact, [0, this.owner.address])) as BlueHorizonToken
  })

  it('has correct settings', async function () {
    const privateSale = await this.blh.PRIVATE_SALE()
    const publicSale = await this.blh.PUBLIC_SALE()
    const liquidity = await this.blh.LIQUIDITY()
    const team = await this.blh.TEAM()
    const advisor = await this.blh.ADVISOR()
    const development = await this.blh.DEVELOPMENT()
    const marketing = await this.blh.MARKETING()
    const farming = await this.blh.FARMING()

    expect(privateSale).to.eq(parseEther('15000000'))
    expect(publicSale).to.eq(parseEther('5000000'))
    expect(liquidity).to.eq(parseEther('5000000'))
    expect(team).to.eq(parseEther('10000000'))
    expect(advisor).to.eq(parseEther('5000000'))
    expect(development).to.eq(parseEther('10000000'))
    expect(marketing).to.eq(parseEther('10000000'))
    expect(farming).to.eq(FARMING)
    expect(
      privateSale.add(publicSale).add(liquidity).add(team).add(advisor).add(development).add(marketing).add(farming)
    ).to.eq(parseEther('100000000'))

    expect(await this.blh.totalSupply()).to.eq(parseEther('25000000'))
    expect(await this.blh.balanceOf(this.owner.address)).to.eq(parseEther('25000000'))
  })

  describe('#setMaster', function () {
    it('sets masterChef properly', async function () {
      await expect(this.blh.setMaster('0x0000000000000000000000000000000000000000')).to.be.revertedWith(
        'BlueHorizonToken: invalid masterChef'
      )
      await expect(this.blh.setMaster(this.master.address)).to.not.be.reverted
    })
  })

  describe('#setNftMaster', function () {
    it('sets masterChef properly', async function () {
      await expect(this.blh.setNftMaster('0x0000000000000000000000000000000000000000')).to.be.revertedWith(
        'BlueHorizonToken: invalid nftMasterChef'
      )
      await expect(this.blh.setNftMaster(this.nftMaster.address)).to.not.be.reverted
    })
  })

  describe('#transfer', function () {
    it('transfers properly', async function () {
      await this.blh.setMaster(this.master.address)
      await this.blh.connect(this.master).mint(this.alice.address, parseEther('100'))
      expect(await this.blh.balanceOf(this.alice.address)).to.eq(parseEther('100'))
      await this.blh.connect(this.alice).transfer(this.bob.address, parseEther('10'))
      expect(await this.blh.balanceOf(this.alice.address)).to.eq(parseEther('90'))
      expect(await this.blh.balanceOf(this.bob.address)).to.eq(parseEther('10'))
      await expect(this.blh.connect(this.bob).transfer(this.carol.address, parseEther('20'))).to.be.revertedWith(
        'ERC20: transfer amount exceeds balance'
      )
      expect(await this.blh.balanceOf(this.alice.address)).to.eq(parseEther('90'))
      expect(await this.blh.balanceOf(this.bob.address)).to.eq(parseEther('10'))
      expect(await this.blh.balanceOf(this.carol.address)).to.eq(0)
    })
  })

  describe('#mint', function () {
    it('fails if overmint', async function () {
      await this.blh.setMaster(this.master.address)
      await expect(this.blh.connect(this.master).mint(this.alice.address, parseEther('40000001'))).to.be.revertedWith(
        'BlueHorizonToken: exceeds limitation!'
      )
    })

    it('only allows master to mint tokens', async function () {
      await expect(this.blh.connect(this.master).mint(this.alice.address, parseEther('1'))).to.be.revertedWith(
        'BlueHorizonToken: only master can mint'
      )
      await this.blh.setMaster(this.master.address)
      await this.blh.connect(this.master).mint(this.alice.address, parseEther('10'))
      await this.blh.connect(this.master).mint(this.bob.address, parseEther('1'))
      expect(await this.blh.totalSupply()).to.eq(parseEther('25000011'))
      expect(await this.blh.balanceOf(this.alice.address)).to.eq(parseEther('10'))
      expect(await this.blh.balanceOf(this.bob.address)).to.eq(parseEther('1'))
    })

    it('mints correctly according to vesting schedule', async function () {
      const monthlyEmission = FARMING.div(12)

      await this.blh.setMaster(this.master.address)
      await this.blh.connect(this.master).mint(this.alice.address, monthlyEmission)
      expect(await this.blh.totalSupply()).to.eq(parseEther('28333333.333333333333333333'))
      expect(await this.blh.balanceOf(this.alice.address)).to.eq(parseEther('3333333.333333333333333333'))
      await this.blh.connect(this.master).mint(this.bob.address, 1)
      expect(await this.blh.totalSupply()).to.eq(parseEther('28333333.333333333333333333'))
      expect(await this.blh.balanceOf(this.bob.address)).to.eq(0)
      expect(await this.blh.farmingUnlocked()).to.eq(monthlyEmission)

      for (let i = 1; i <= 11; i++) {
        await increase(MONTH_IN_SECONDS)
        const aliceBal = await this.blh.balanceOf(this.alice.address)
        const bobBal = await this.blh.balanceOf(this.bob.address)
        const carolBal = await this.blh.balanceOf(this.carol.address)
        const totalSupply = await this.blh.totalSupply()

        await this.blh.connect(this.master).mint(this.alice.address, parseEther('3333333'))
        expect((await this.blh.totalSupply()).sub(totalSupply)).to.eq(parseEther('3333333'))
        expect((await this.blh.balanceOf(this.alice.address)).sub(aliceBal)).to.eq(parseEther('3333333'))

        await this.blh.connect(this.master).mint(this.bob.address, parseEther('0.333333333333333333'))
        expect((await this.blh.totalSupply()).sub(totalSupply)).to.eq(monthlyEmission)
        expect((await this.blh.balanceOf(this.bob.address)).sub(bobBal)).to.eq(parseEther('0.333333333333333333'))

        await this.blh.connect(this.master).mint(this.carol.address, 100)
        const dust = i % 3 == 2 ? 1 : 0
        expect((await this.blh.totalSupply()).sub(totalSupply).sub(dust)).to.eq(monthlyEmission)
        expect((await this.blh.balanceOf(this.carol.address)).sub(carolBal)).to.eq(dust)
        expect((await this.blh.farmingUnlocked()).sub(monthlyEmission.mul(i + 1)))
          .be.least(0)
          .and.most(4)
      }
    })
  })

  describe('minting for Team, Advisor, Development and Marketing', function () {
    it('only allows owner to mint tokens', async function () {
      await expect(this.blh.connect(this.alice).mintTeam(this.alice.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
      await expect(this.blh.connect(this.alice).mintAdvisor(this.alice.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
      await expect(this.blh.connect(this.alice).mintDevelopment(this.alice.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
      await expect(this.blh.connect(this.alice).mintMarketing(this.alice.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
      expect(await this.blh.balanceOf(this.alice.address)).to.eq(0)
      expect(await this.blh.totalSupply()).to.be.eq(parseEther('25000000'))
      await this.blh.mintDevelopment(this.alice.address)
      expect(await this.blh.totalSupply()).to.be.eq(parseEther('25833333.333333333333333333'))
      expect(await this.blh.balanceOf(this.alice.address)).to.be.eq(parseEther('833333.333333333333333333'))
    })

    it('mints correctly for team', async function () {
      // TGE + 3 months: 1,111,111 monthly emission
      const monthlyEmission = parseEther('1111111.111111111111111111')
      // TGE
      await increase(1)
      expect(await this.blh.mintableTeam()).to.eq(0)
      expect(await this.blh.balanceOf(this.team.address)).to.eq(0)
      expect(await this.blh.teamUnlocked()).to.eq(0)
      await this.blh.mintTeam(this.team.address)
      expect(await this.blh.balanceOf(this.team.address)).to.eq(0)
      expect(await this.blh.teamUnlocked()).to.eq(0)
      expect(await this.blh.totalSupply()).to.eq(parseEther('25000000'))

      // month 1
      await increase(MONTH_IN_SECONDS)
      expect(await this.blh.mintableTeam()).to.eq(0)
      await this.blh.mintTeam(this.team.address)
      expect(await this.blh.balanceOf(this.team.address)).to.eq(0)
      expect(await this.blh.teamUnlocked()).to.eq(0)
      expect(await this.blh.totalSupply()).to.eq(parseEther('25000000'))
      expect(await this.blh.mintableTeam()).to.eq(0)

      // month 2
      await increase(MONTH_IN_SECONDS)
      expect(await this.blh.mintableTeam()).to.eq(0)
      await this.blh.mintTeam(this.team.address)
      expect(await this.blh.balanceOf(this.team.address)).to.eq(0)
      expect(await this.blh.teamUnlocked()).to.eq(0)
      expect(await this.blh.totalSupply()).to.eq(parseEther('25000000'))
      expect(await this.blh.mintableTeam()).to.eq(0)

      for (let i = 3; i < 11; i++) {
        await increase(MONTH_IN_SECONDS)
        expect(await this.blh.mintableTeam()).to.eq(monthlyEmission)
        const teamBal = await this.blh.balanceOf(this.team.address)
        const totalSupply = await this.blh.totalSupply()
        const teamUnlocked = await this.blh.teamUnlocked()
        await this.blh.mintTeam(this.team.address)
        expect(await this.blh.balanceOf(this.team.address)).to.eq(monthlyEmission.add(teamBal))
        expect(await this.blh.totalSupply()).to.eq(monthlyEmission.add(totalSupply))
        expect(await this.blh.teamUnlocked()).to.eq(monthlyEmission.add(teamUnlocked))
        expect(await this.blh.mintableTeam()).to.eq(0)
      }

      // month 12
      await increase(MONTH_IN_SECONDS)
      expect(await this.blh.mintableTeam()).to.eq(parseEther('1111111.111111111111111112'))
      await this.blh.mintTeam(this.team.address)
      expect(await this.blh.balanceOf(this.team.address)).to.eq(parseEther('10000000'))
      expect(await this.blh.teamUnlocked()).to.eq(parseEther('10000000'))
      expect(await this.blh.totalSupply()).to.eq(parseEther('35000000'))
      expect(await this.blh.mintableTeam()).to.eq(0)
    })

    it('mints correctly for advisor', async function () {
      // TGE + 3 months: 555,556 monthly emission
      const monthlyEmission = parseEther('555555.555555555555555555')
      // TGE
      await increase(1)
      expect(await this.blh.mintableAdvisor()).to.eq(0)
      expect(await this.blh.balanceOf(this.advisor.address)).to.eq(0)
      expect(await this.blh.advisorUnlocked()).to.eq(0)
      await this.blh.mintAdvisor(this.advisor.address)
      expect(await this.blh.balanceOf(this.advisor.address)).to.eq(0)
      expect(await this.blh.advisorUnlocked()).to.eq(0)
      expect(await this.blh.totalSupply()).to.eq(parseEther('25000000'))

      // month 1
      await increase(MONTH_IN_SECONDS)
      expect(await this.blh.mintableAdvisor()).to.eq(0)
      await this.blh.mintAdvisor(this.advisor.address)
      expect(await this.blh.balanceOf(this.advisor.address)).to.eq(0)
      expect(await this.blh.advisorUnlocked()).to.eq(0)
      expect(await this.blh.totalSupply()).to.eq(parseEther('25000000'))
      expect(await this.blh.mintableAdvisor()).to.eq(0)

      // month 2
      await increase(MONTH_IN_SECONDS)
      expect(await this.blh.mintableAdvisor()).to.eq(0)
      await this.blh.mintAdvisor(this.advisor.address)
      expect(await this.blh.balanceOf(this.advisor.address)).to.eq(0)
      expect(await this.blh.advisorUnlocked()).to.eq(0)
      expect(await this.blh.totalSupply()).to.eq(parseEther('25000000'))
      expect(await this.blh.mintableAdvisor()).to.eq(0)

      for (let i = 3; i < 11; i++) {
        await increase(MONTH_IN_SECONDS)
        const dust = i % 2 == 0 ? 1 : 0
        const advisorBal = await this.blh.balanceOf(this.advisor.address)
        const totalSupply = await this.blh.totalSupply()
        const advisorUnlocked = await this.blh.advisorUnlocked()

        expect(await this.blh.mintableAdvisor()).to.eq(monthlyEmission.add(dust))
        await this.blh.mintAdvisor(this.advisor.address)
        expect(await this.blh.balanceOf(this.advisor.address)).to.eq(monthlyEmission.add(advisorBal).add(dust))
        expect(await this.blh.totalSupply()).to.eq(monthlyEmission.add(totalSupply).add(dust))
        expect(await this.blh.advisorUnlocked()).to.eq(monthlyEmission.add(advisorUnlocked).add(dust))
        expect(await this.blh.mintableAdvisor()).to.eq(0)
      }

      // month 12
      await increase(MONTH_IN_SECONDS)
      expect(await this.blh.mintableAdvisor()).to.eq(monthlyEmission.add(1))
      await this.blh.mintAdvisor(this.advisor.address)
      expect(await this.blh.balanceOf(this.advisor.address)).to.eq(parseEther('5000000'))
      expect(await this.blh.advisorUnlocked()).to.eq(parseEther('5000000'))
      expect(await this.blh.totalSupply()).to.eq(parseEther('30000000'))
      expect(await this.blh.mintableAdvisor()).to.eq(0)
    })

    it('mints correctly for development', async function () {
      // TGE: 833,333 monthly emission
      const monthlyEmission = parseEther('833333.333333333333333333')
      // TGE
      await increase(1)
      expect(await this.blh.mintableDevelopment()).to.eq(monthlyEmission)
      expect(await this.blh.balanceOf(this.fund.address)).to.eq(0)
      expect(await this.blh.developmentUnlocked()).to.eq(0)
      await this.blh.mintDevelopment(this.fund.address)
      expect(await this.blh.balanceOf(this.fund.address)).to.eq(monthlyEmission)
      expect(await this.blh.developmentUnlocked()).to.eq(monthlyEmission)
      expect(await this.blh.totalSupply()).to.eq(parseEther('25000000').add(monthlyEmission))

      for (let i = 1; i < 11; i++) {
        await increase(MONTH_IN_SECONDS)
        const dust = i % 3 == 2 ? 1 : 0
        const developmentBal = await this.blh.balanceOf(this.fund.address)
        const totalSupply = await this.blh.totalSupply()
        const developmentUnlocked = await this.blh.developmentUnlocked()

        expect(await this.blh.mintableDevelopment()).to.eq(monthlyEmission.add(dust))
        await this.blh.mintDevelopment(this.fund.address)
        expect(await this.blh.balanceOf(this.fund.address)).to.eq(monthlyEmission.add(developmentBal).add(dust))
        expect(await this.blh.totalSupply()).to.eq(monthlyEmission.add(totalSupply).add(dust))
        expect(await this.blh.developmentUnlocked()).to.eq(monthlyEmission.add(developmentUnlocked).add(dust))
        expect(await this.blh.mintableDevelopment()).to.eq(0)
      }

      // month 12
      await increase(MONTH_IN_SECONDS)
      expect(await this.blh.mintableDevelopment()).to.eq(monthlyEmission.add(1))
      await this.blh.mintDevelopment(this.fund.address)
      expect(await this.blh.balanceOf(this.fund.address)).to.eq(parseEther('10000000'))
      expect(await this.blh.developmentUnlocked()).to.eq(parseEther('10000000'))
      expect(await this.blh.totalSupply()).to.eq(parseEther('35000000'))
      expect(await this.blh.mintableDevelopment()).to.eq(0)
    })

    it('mints correctly for marketing', async function () {
      // TGE: 833,333 monthly emission
      const monthlyEmission = parseEther('833333.333333333333333333')
      // TGE
      await increase(1)
      expect(await this.blh.mintableMarketing()).to.eq(monthlyEmission)
      expect(await this.blh.balanceOf(this.fund.address)).to.eq(0)
      expect(await this.blh.marketingUnlocked()).to.eq(0)
      await this.blh.mintMarketing(this.fund.address)
      expect(await this.blh.balanceOf(this.fund.address)).to.eq(monthlyEmission)
      expect(await this.blh.marketingUnlocked()).to.eq(monthlyEmission)
      expect(await this.blh.totalSupply()).to.eq(parseEther('25000000').add(monthlyEmission))

      for (let i = 1; i < 11; i++) {
        await increase(MONTH_IN_SECONDS)
        const dust = i % 3 == 2 ? 1 : 0
        const marketingBal = await this.blh.balanceOf(this.fund.address)
        const totalSupply = await this.blh.totalSupply()
        const marketingUnlocked = await this.blh.marketingUnlocked()

        expect(await this.blh.mintableMarketing()).to.eq(monthlyEmission.add(dust))
        await this.blh.mintMarketing(this.fund.address)
        expect(await this.blh.balanceOf(this.fund.address)).to.eq(monthlyEmission.add(marketingBal).add(dust))
        expect(await this.blh.totalSupply()).to.eq(monthlyEmission.add(totalSupply).add(dust))
        expect(await this.blh.marketingUnlocked()).to.eq(monthlyEmission.add(marketingUnlocked).add(dust))
        expect(await this.blh.mintableMarketing()).to.eq(0)
      }

      // month 12
      await increase(MONTH_IN_SECONDS)
      expect(await this.blh.mintableMarketing()).to.eq(monthlyEmission.add(1))
      await this.blh.mintMarketing(this.fund.address)
      expect(await this.blh.balanceOf(this.fund.address)).to.eq(parseEther('10000000'))
      expect(await this.blh.marketingUnlocked()).to.eq(parseEther('10000000'))
      expect(await this.blh.totalSupply()).to.eq(parseEther('35000000'))
      expect(await this.blh.mintableMarketing()).to.eq(0)
    })
  })
})

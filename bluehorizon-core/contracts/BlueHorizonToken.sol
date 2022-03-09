// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.7;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract BlueHorizonToken is Ownable, ERC20 {
    uint256 constant MONTH_IN_SECONDS = 30 * 86400;
    uint256 constant MAX_SUPPLY = 100000000e18; // 100,000,000

    uint256 public constant PRIVATE_SALE = 15000000e18; // 15%
    uint256 public constant PUBLIC_SALE = 5000000e18; // 5%
    uint256 public constant LIQUIDITY = 5000000e18; // 5%

    uint256 public constant TEAM = 10000000e18; // 10%
    uint256 public constant ADVISOR = 5000000e18; // 5%
    uint256 public constant DEVELOPMENT = 10000000e18; // 10%
    uint256 public constant MARKETING = 10000000e18; // 10%
    uint256 public constant FARMING = 40000000e18; // 40%

    uint256 public initTime;

    address public masterChef;
    address public nftMasterChef;

    uint256 public teamUnlocked = 0;
    uint256 public advisorUnlocked = 0;
    uint256 public developmentUnlocked = 0;
    uint256 public marketingUnlocked = 0;
    uint256 public farmingUnlocked = 0;

    constructor(uint256 _initTime, address _recipient) ERC20('BlueHorizon', 'BLH') {
        initTime = _initTime != 0 ? _initTime : block.timestamp;

        uint256 totalUnlocked = 0;
        totalUnlocked += PRIVATE_SALE;
        totalUnlocked += PUBLIC_SALE;
        totalUnlocked += LIQUIDITY;
        _mint(_recipient, totalUnlocked);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);

        if (from == address(0)) {
            require(totalSupply() + amount <= MAX_SUPPLY, 'BlueHorizonToken: exceeds max supply!');
        }
    }

    /**
     * @dev mint tokens for masterChef
     * callable by masterChef contracts only
     */
    function mint(address _recipient, uint256 _amount) public {
        require(msg.sender == masterChef || msg.sender == nftMasterChef, 'BlueHorizonToken: only master can mint');
        require(FARMING >= _amount, 'BlueHorizonToken: exceeds limitation!');

        uint256 amount = mintableFarming();
        amount = amount > _amount ? _amount : amount;
        if (amount > 0) {
            farmingUnlocked += amount;
            _mint(_recipient, amount);
        }
    }

    /**
     * @dev mintable tokens for farming
     */
    function mintableFarming() public view returns (uint256) {
        if (initTime == 0) return 0;
        uint256 startReleasing = initTime;
        if (startReleasing > block.timestamp) return 0;

        uint256 gap = block.timestamp - startReleasing;
        uint256 months = gap / MONTH_IN_SECONDS + 1;
        uint256 totalMintable = (months * FARMING) / 12;
        if (totalMintable > FARMING) {
            totalMintable = FARMING;
        }
        return totalMintable - farmingUnlocked;
    }

    /**
     * @dev mintable tokens for team
     */
    function mintableTeam() public view returns (uint256) {
        if (initTime == 0) return 0;
        uint256 startReleasing = initTime + 3 * MONTH_IN_SECONDS;
        if (startReleasing > block.timestamp) return 0;

        uint256 gap = block.timestamp - startReleasing;
        uint256 months = gap / MONTH_IN_SECONDS + 1;
        uint256 totalMintable = (months * TEAM) / 9;
        if (totalMintable > TEAM) {
            totalMintable = TEAM;
        }
        return totalMintable - teamUnlocked;
    }

    /**
     * @dev mintable tokens for advisor
     */
    function mintableAdvisor() public view returns (uint256) {
        if (initTime == 0) return 0;
        uint256 startReleasing = initTime + 3 * MONTH_IN_SECONDS;
        if (startReleasing > block.timestamp) return 0;

        uint256 gap = block.timestamp - startReleasing;
        uint256 months = gap / MONTH_IN_SECONDS + 1;
        uint256 totalMintable = (months * ADVISOR) / 9;
        if (totalMintable > ADVISOR) {
            totalMintable = ADVISOR;
        }
        return totalMintable - advisorUnlocked;
    }

    /**
     * @dev mintable tokens for development
     */
    function mintableDevelopment() public view returns (uint256) {
        if (initTime == 0) return 0;
        uint256 startReleasing = initTime;
        if (startReleasing > block.timestamp) return 0;

        uint256 gap = block.timestamp - startReleasing;
        uint256 months = gap / MONTH_IN_SECONDS + 1;
        uint256 totalMintable = (months * DEVELOPMENT) / 12;
        if (totalMintable > DEVELOPMENT) {
            totalMintable = DEVELOPMENT;
        }
        return totalMintable - developmentUnlocked;
    }

    /**
     * @dev mintable tokens for marketing
     */
    function mintableMarketing() public view returns (uint256) {
        if (initTime == 0) return 0;
        uint256 startReleasing = initTime;
        if (startReleasing > block.timestamp) return 0;

        uint256 gap = block.timestamp - startReleasing;
        uint256 months = gap / MONTH_IN_SECONDS + 1;
        uint256 totalMintable = (months * MARKETING) / 12;
        if (totalMintable > MARKETING) {
            totalMintable = MARKETING;
        }
        return totalMintable - marketingUnlocked;
    }

    /**
     * @dev mint tokens for team
     * callable by owner
     */
    function mintTeam(address _recipient) external onlyOwner {
        uint256 mintable = mintableTeam();
        if (mintable > 0) {
            teamUnlocked += mintable;
            _mint(_recipient, mintable);
        }
    }

    /**
     * @dev mint tokens for advisor
     * callable by owner
     */
    function mintAdvisor(address _recipient) external onlyOwner {
        uint256 mintable = mintableAdvisor();
        if (mintable > 0) {
            advisorUnlocked += mintable;
            _mint(_recipient, mintable);
        }
    }

    /**
     * @dev mint tokens for development
     * callable by owner
     */
    function mintDevelopment(address _recipient) external onlyOwner {
        uint256 mintable = mintableDevelopment();
        if (mintable > 0) {
            developmentUnlocked += mintable;
            _mint(_recipient, mintable);
        }
    }

    /**
     * @dev mint tokens for marketing
     * callable by owner
     */
    function mintMarketing(address _recipient) external onlyOwner {
        uint256 mintable = mintableMarketing();
        if (mintable > 0) {
            marketingUnlocked += mintable;
            _mint(_recipient, mintable);
        }
    }

    /**
     * @dev set masterChef
     * callable by owner
     */
    function setMaster(address _masterChef) public onlyOwner {
        require(_masterChef != address(0), 'BlueHorizonToken: invalid masterChef');
        masterChef = _masterChef;
    }

    /**
     * @dev set nftMasterChef
     * callable by owner
     */
    function setNftMaster(address _masterChef) public onlyOwner {
        require(_masterChef != address(0), 'BlueHorizonToken: invalid nftMasterChef');
        nftMasterChef = _masterChef;
    }
}

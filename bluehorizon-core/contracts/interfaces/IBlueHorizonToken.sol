// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.7;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IBlueHorizonToken is IERC20 {
    function mint(address _recipient, uint256 _amount) external;

    function mintableFarming() external view returns (uint256);
}

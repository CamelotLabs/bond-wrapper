// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20("Mock Token", "MOCK") {
    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}

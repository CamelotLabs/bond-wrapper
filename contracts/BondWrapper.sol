// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "hardhat/console.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

//import "./interfaces/IXGrailToken.sol";


contract BondWrapper is Ownable, ERC20("Camelot bond wrapper", "bondXGRAIL") {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    IERC20 public immutable xGrailToken;
    EnumerableSet.AddressSet private _bondContracts;

    constructor(IERC20 xGrailToken_) {
        xGrailToken = xGrailToken_;
    }

    /********************************************/
    /****************** EVENTS ******************/
    /********************************************/

    event SetBondContract(address indexed bondContract, bool add);
    event Wrap(address indexed sender, uint256 amount);
    event Unwrap(address indexed sender, address indexed to, uint256 amount);

    /*******************************************************/
    /****************** VIEWS ******************/
    /*******************************************************/

    /**
     * @dev returns if "account" is a whitelisted bond contract
    */
    function isBondContract(address account) public view returns (bool) {
        return _bondContracts.contains(account);
    }

    /*******************************************************/
    /****************** OWNABLE FUNCTIONS ******************/
    /*******************************************************/

    function setBondContract(address bondContract, bool add) external onlyOwner {
        require(bondContract != address(0), "invalid address");

        if(add) _bondContracts.add(bondContract);
        else _bondContracts.remove(bondContract);
        emit SetBondContract(bondContract, add);
    }

    function wrap(uint256 amount) external onlyOwner {
        require(amount > 0, "invalid amount");

        _mint(msg.sender, amount);
        emit Wrap(msg.sender, amount);
        xGrailToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    function _transfer(address from, address to, uint256 amount) internal virtual override {
        // Unwrap
        if(isBondContract(from)) {
            _burn(from, amount);
            xGrailToken.safeTransfer(to, amount);
            emit Unwrap(from, to, amount);
        }

        // Regular transfer
        else {
            ERC20._transfer(from, to, amount);
        }
    }
}

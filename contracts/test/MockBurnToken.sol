// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockBurnToken is ERC20 {
    uint256 private constant BURN_BPS = 3_000;
    uint256 private constant BPS_DENOMINATOR = 10_000;

    constructor() ERC20("Mock Burn Token", "BURN") {}

    function mint(address account, uint256 amount) external { _mint(account, amount); }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0) || value == 0) {
            super._update(from, to, value);
            return;
        }
        uint256 burnAmount = (value * BURN_BPS) / BPS_DENOMINATOR;
        super._update(from, address(0), burnAmount);
        super._update(from, to, value - burnAmount);
    }
}

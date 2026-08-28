// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title SmartPay3
/// @notice Site-specific flexible ERC-20 checkout for SmartLingo course packages.
/// @dev SmartLingo stores one rule per three-month level and token mode. The
///      payer supplies one supported learning-language code as secondId; it is
///      recorded in the transaction but does not duplicate the price rule.
///      A rule can be dual-token (USDT plus GLC) or primary-token-only. Dual
///      rules store both 100% prices so pay() can derive the only valid
///      complement. Single-token rules use address(0) and zero values for the
///      secondary token and require the full primary amount. Every payment also
///      carries the public six-character account RefID supplied by the payer.
///      RefID case is deliberately preserved for third-party clients; each
///      website performs case-insensitive account matching.
contract SmartPay3 is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    string public constant MAIN_ID_BASIC_3_MONTH = "smartlingo_course_basic_3m";
    string public constant MAIN_ID_INTERMEDIATE_3_MONTH = "smartlingo_course_intermediate_3m";
    string public constant MAIN_ID_ADVANCED_3_MONTH = "smartlingo_course_advanced_3m";
    string public constant SUBSCRIPTION_SECOND_ID = "";

    uint256 public constant MAX_ID_BYTES = 96;
    uint256 public constant REF_ID_BYTES = 6;
    uint256 public constant MAX_PAGE_SIZE = 100;
    uint256 public constant MAX_PAYOUT_WALLETS = 5;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    struct PaymentRule {
        address primaryTokenAddress;
        address secondaryTokenAddress;
        string mainId;
        string secondId;
        uint256 primaryTokenAmount;
        uint256 secondaryTokenAmount;
        uint256 minimumSecondaryBalance;
        bool enabled;
    }

    struct TransactionRecord {
        bytes32 transactionId;
        uint64 timestamp;
        address wallet;
        string refId;
        string mainId;
        string secondId;
        address primaryTokenAddress;
        uint256 primaryTokenAmount;
        address secondaryTokenAddress;
        uint256 secondaryTokenAmount;
    }

    error EmptyMainId();
    error IdTooLong();
    error InvalidRefId();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidPageSize();
    error InvalidPayoutConfiguration();
    error DuplicatePayoutWallet();
    error DuplicateToken();
    error TransactionNotFound();
    error PaymentRuleDisabled();
    error PayoutsNotConfigured();
    error InvalidPaymentRatio();
    error SecondaryBalanceEligibilityNotMet();
    error TokenTransferAmountMismatch();
    error OwnershipRenunciationDisabled();
    error UnsupportedPaymentProduct();
    error UnsupportedLearningLanguage();

    event PaymentRuleUpdated(
        address indexed primaryTokenAddress,
        address indexed secondaryTokenAddress,
        bytes32 indexed mainIdHash,
        bytes32 secondIdHash,
        uint256 primaryTokenAmount,
        uint256 secondaryTokenAmount,
        uint256 minimumSecondaryBalance,
        bool enabled,
        string mainId,
        string secondId
    );
    event TransactionRecorded(
        bytes32 indexed transactionId,
        uint64 timestamp,
        address indexed wallet,
        string refId,
        string mainId,
        string secondId,
        address indexed primaryTokenAddress,
        uint256 primaryTokenAmount,
        address secondaryTokenAddress,
        uint256 secondaryTokenAmount
    );
    event PayoutConfigurationUpdated(bytes32 indexed configHash, address[] wallets, uint16[] sharesBps);
    event PayoutExecuted(
        bytes32 indexed transactionId,
        address indexed tokenAddress,
        address indexed wallet,
        uint256 tokenAmount
    );
    event TokenWithdrawn(address indexed tokenAddress, address indexed ownerWallet, uint256 tokenAmount);

    uint256 public totalTransactions;
    bytes32 public payoutConfigHash;

    mapping(bytes32 => PaymentRule) private _paymentRules;
    bytes32[] private _paymentRuleKeys;
    mapping(bytes32 => bool) private _registeredPaymentRuleKeys;
    mapping(bytes32 => TransactionRecord) private _transactions;
    bytes32[] private _transactionIds;
    mapping(address => bytes32[]) private _walletTransactionIds;
    mapping(address => uint256) private _walletNonces;
    address[] private _payoutWallets;
    uint16[] private _payoutSharesBps;

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setPaymentRule(
        address primaryTokenAddress,
        address secondaryTokenAddress,
        string calldata mainId,
        string calldata secondId,
        uint256 primaryTokenAmount,
        uint256 secondaryTokenAmount,
        uint256 minimumSecondaryBalance,
        bool enabled
    ) external onlyOwner {
        _setPaymentRule(
            primaryTokenAddress,
            secondaryTokenAddress,
            mainId,
            secondId,
            primaryTokenAmount,
            secondaryTokenAmount,
            minimumSecondaryBalance,
            enabled
        );
    }

    function paymentRule(
        address primaryTokenAddress,
        address secondaryTokenAddress,
        string calldata mainId,
        string calldata secondId
    ) external view returns (
        uint256 primaryTokenAmount,
        uint256 secondaryTokenAmount,
        uint256 minimumSecondaryBalance,
        bool enabled
    ) {
        PaymentRule memory rule = _paymentRules[_ruleKey(primaryTokenAddress, secondaryTokenAddress, mainId, secondId)];
        return (rule.primaryTokenAmount, rule.secondaryTokenAmount, rule.minimumSecondaryBalance, rule.enabled);
    }

    function paymentRuleCount() external view returns (uint256) {
        return _paymentRuleKeys.length;
    }

    function paymentRules(uint256 offset, uint256 limit) external view returns (PaymentRule[] memory page) {
        uint256 size = _pageSize(_paymentRuleKeys.length, offset, limit);
        page = new PaymentRule[](size);
        for (uint256 index; index < size; ++index) {
            page[index] = _paymentRules[_paymentRuleKeys[offset + index]];
        }
    }

    function pay(
        address primaryTokenAddress,
        address secondaryTokenAddress,
        string calldata mainId,
        string calldata secondId,
        uint256 primaryTokenAmount,
        string calldata refId
    ) external whenNotPaused nonReentrant returns (bytes32 transactionId) {
        _validatePurchaseIds(mainId, secondId);
        _validateRefId(refId);
        PaymentRule memory rule = _paymentRules[
            _ruleKey(primaryTokenAddress, secondaryTokenAddress, mainId, SUBSCRIPTION_SECOND_ID)
        ];
        if (!rule.enabled || rule.primaryTokenAmount == 0) {
            revert PaymentRuleDisabled();
        }
        if (_payoutWallets.length == 0) revert PayoutsNotConfigured();
        uint256 secondaryTokenAmount;
        if (rule.secondaryTokenAddress == address(0)) {
            if (primaryTokenAmount != rule.primaryTokenAmount) revert InvalidPaymentRatio();
        } else {
            if (rule.secondaryTokenAmount == 0 || primaryTokenAmount > rule.primaryTokenAmount) {
                revert InvalidPaymentRatio();
            }
            uint256 secondaryNumerator = rule.secondaryTokenAmount * (rule.primaryTokenAmount - primaryTokenAmount);
            if (secondaryNumerator % rule.primaryTokenAmount != 0) revert InvalidPaymentRatio();
            secondaryTokenAmount = secondaryNumerator / rule.primaryTokenAmount;
            if (
                secondaryTokenAmount != 0
                    && IERC20(secondaryTokenAddress).balanceOf(msg.sender) < rule.minimumSecondaryBalance
            ) revert SecondaryBalanceEligibilityNotMet();
        }

        transactionId = _nextTransactionId(rule, primaryTokenAmount, secondaryTokenAmount, mainId, secondId, refId);
        if (primaryTokenAmount != 0) _collectPayment(primaryTokenAddress, primaryTokenAmount, transactionId);
        if (secondaryTokenAmount != 0) _collectPayment(secondaryTokenAddress, secondaryTokenAmount, transactionId);
        TransactionRecord memory record = TransactionRecord({
            transactionId: transactionId,
            timestamp: uint64(block.timestamp),
            wallet: msg.sender,
            refId: refId,
            mainId: mainId,
            secondId: secondId,
            primaryTokenAddress: primaryTokenAddress,
            primaryTokenAmount: primaryTokenAmount,
            secondaryTokenAddress: secondaryTokenAddress,
            secondaryTokenAmount: secondaryTokenAmount
        });
        _transactions[transactionId] = record;
        _transactionIds.push(transactionId);
        _walletTransactionIds[msg.sender].push(transactionId);
        ++totalTransactions;
        emit TransactionRecorded(
            record.transactionId,
            record.timestamp,
            record.wallet,
            record.refId,
            record.mainId,
            record.secondId,
            record.primaryTokenAddress,
            record.primaryTokenAmount,
            record.secondaryTokenAddress,
            record.secondaryTokenAmount
        );
    }

    function transactionById(bytes32 transactionId) external view returns (TransactionRecord memory) {
        TransactionRecord storage record = _transactions[transactionId];
        if (record.wallet == address(0)) revert TransactionNotFound();
        return record;
    }

    function latestTransactions(address wallet, uint256 maxCount)
        external
        view
        returns (TransactionRecord[] memory page, uint256 total)
    {
        if (wallet == address(0)) return _latestTransactions(_transactionIds, maxCount);
        return _latestTransactions(_walletTransactionIds[wallet], maxCount);
    }

    function _latestTransactions(bytes32[] storage ids, uint256 maxCount)
        private
        view
        returns (TransactionRecord[] memory page, uint256 total)
    {
        total = ids.length;
        uint256 size = _latestPageSize(total, maxCount);
        page = new TransactionRecord[](size);
        for (uint256 index; index < size; ++index) {
            page[index] = _transactions[ids[total - 1 - index]];
        }
    }

    function setPayouts(address[] calldata wallets, uint16[] calldata sharesBps) external onlyOwner {
        _setPayouts(wallets, sharesBps);
    }

    function payoutConfiguration() external view returns (address[] memory wallets, uint16[] memory sharesBps) {
        return (_payoutWallets, _payoutSharesBps);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function withdrawToken(address tokenAddress, uint256 tokenAmount) external onlyOwner nonReentrant {
        if (tokenAddress == address(0)) revert InvalidAddress();
        if (tokenAmount == 0) revert InvalidAmount();
        address ownerWallet = owner();
        IERC20(tokenAddress).safeTransfer(ownerWallet, tokenAmount);
        emit TokenWithdrawn(tokenAddress, ownerWallet, tokenAmount);
    }

    function renounceOwnership() public pure override {
        revert OwnershipRenunciationDisabled();
    }

    function _setPaymentRule(
        address primaryTokenAddress,
        address secondaryTokenAddress,
        string memory mainId,
        string memory secondId,
        uint256 primaryTokenAmount,
        uint256 secondaryTokenAmount,
        uint256 minimumSecondaryBalance,
        bool enabled
    ) private {
        if (primaryTokenAddress == address(0) || primaryTokenAddress.code.length == 0) revert InvalidAddress();
        if (secondaryTokenAddress != address(0)) {
            if (secondaryTokenAddress.code.length == 0) revert InvalidAddress();
            if (primaryTokenAddress == secondaryTokenAddress) revert DuplicateToken();
        } else if (secondaryTokenAmount != 0 || minimumSecondaryBalance != 0) {
            revert InvalidAmount();
        }
        _validateRuleIds(mainId, secondId);
        if (enabled && primaryTokenAmount == 0) revert InvalidAmount();
        if (
            enabled && secondaryTokenAddress != address(0)
                && (secondaryTokenAmount == 0 || minimumSecondaryBalance == 0)
        ) revert InvalidAmount();
        bytes32 key = _ruleKey(primaryTokenAddress, secondaryTokenAddress, mainId, secondId);
        if (!_registeredPaymentRuleKeys[key]) {
            _registeredPaymentRuleKeys[key] = true;
            _paymentRuleKeys.push(key);
        }
        _paymentRules[key] = PaymentRule({
            primaryTokenAddress: primaryTokenAddress,
            secondaryTokenAddress: secondaryTokenAddress,
            mainId: mainId,
            secondId: secondId,
            primaryTokenAmount: primaryTokenAmount,
            secondaryTokenAmount: secondaryTokenAmount,
            minimumSecondaryBalance: minimumSecondaryBalance,
            enabled: enabled
        });
        emit PaymentRuleUpdated(
            primaryTokenAddress,
            secondaryTokenAddress,
            keccak256(bytes(mainId)),
            keccak256(bytes(secondId)),
            primaryTokenAmount,
            secondaryTokenAmount,
            minimumSecondaryBalance,
            enabled,
            mainId,
            secondId
        );
    }

    function _validateIds(string memory mainId, string memory secondId) private pure {
        uint256 mainLength = bytes(mainId).length;
        if (mainLength == 0) revert EmptyMainId();
        if (mainLength > MAX_ID_BYTES || bytes(secondId).length > MAX_ID_BYTES) revert IdTooLong();
    }

    function _validateRuleIds(string memory mainId, string memory secondId) private pure {
        _validateIds(mainId, secondId);
        if (!_isSupportedMainId(mainId)) revert UnsupportedPaymentProduct();
        if (bytes(secondId).length != 0) revert UnsupportedLearningLanguage();
    }

    function _validatePurchaseIds(string memory mainId, string memory secondId) private pure {
        _validateIds(mainId, secondId);
        if (!_isSupportedMainId(mainId)) revert UnsupportedPaymentProduct();
        if (!_isSupportedLanguage(secondId)) revert UnsupportedLearningLanguage();
    }

    function _isSupportedMainId(string memory mainId) private pure returns (bool) {
        bytes32 value = keccak256(bytes(mainId));
        return value == keccak256(bytes(MAIN_ID_BASIC_3_MONTH))
            || value == keccak256(bytes(MAIN_ID_INTERMEDIATE_3_MONTH))
            || value == keccak256(bytes(MAIN_ID_ADVANCED_3_MONTH));
    }

    function _isSupportedLanguage(string memory language) private pure returns (bool) {
        bytes32 value = keccak256(bytes(language));
        return value == keccak256(bytes("zh"))
            || value == keccak256(bytes("en"))
            || value == keccak256(bytes("es"))
            || value == keccak256(bytes("ja"))
            || value == keccak256(bytes("ko"))
            || value == keccak256(bytes("fr"))
            || value == keccak256(bytes("de"))
            || value == keccak256(bytes("ru"))
            || value == keccak256(bytes("it"))
            || value == keccak256(bytes("pt"))
            || value == keccak256(bytes("ar"))
            || value == keccak256(bytes("hi"));
    }

    function _validateRefId(string memory refId) private pure {
        bytes memory value = bytes(refId);
        if (value.length != REF_ID_BYTES) revert InvalidRefId();
        for (uint256 index; index < value.length; ++index) {
            uint8 character = uint8(value[index]);
            if (character >= 97 && character <= 122) character -= 32;
            bool validLetter = (character >= 65 && character <= 72)
                || (character >= 74 && character <= 78)
                || (character >= 80 && character <= 90);
            bool validDigit = character >= 50 && character <= 57;
            if (!validLetter && !validDigit) revert InvalidRefId();
        }
    }

    function _ruleKey(
        address primaryTokenAddress,
        address secondaryTokenAddress,
        string memory mainId,
        string memory secondId
    ) private pure returns (bytes32) {
        return keccak256(abi.encode(
            primaryTokenAddress,
            secondaryTokenAddress,
            keccak256(bytes(mainId)),
            keccak256(bytes(secondId))
        ));
    }

    function _collectPayment(address tokenAddress, uint256 tokenAmount, bytes32 transactionId) private {
        IERC20 paymentToken = IERC20(tokenAddress);
        uint256 distributed;
        uint256 finalIndex = _payoutWallets.length - 1;
        for (uint256 index; index < finalIndex; ++index) {
            uint256 splitAmount = (tokenAmount * _payoutSharesBps[index]) / BPS_DENOMINATOR;
            if (splitAmount == 0) continue;
            _transferExact(paymentToken, _payoutWallets[index], splitAmount);
            distributed += splitAmount;
            emit PayoutExecuted(transactionId, tokenAddress, _payoutWallets[index], splitAmount);
        }
        uint256 remainder = tokenAmount - distributed;
        _transferExact(paymentToken, _payoutWallets[finalIndex], remainder);
        emit PayoutExecuted(transactionId, tokenAddress, _payoutWallets[finalIndex], remainder);
    }

    function _nextTransactionId(
        PaymentRule memory rule,
        uint256 primaryTokenAmount,
        uint256 secondaryTokenAmount,
        string memory mainId,
        string memory secondId,
        string memory refId
    )
        private
        returns (bytes32)
    {
        uint256 nonce = ++_walletNonces[msg.sender];
        return keccak256(abi.encode(
            address(this),
            block.chainid,
            msg.sender,
            nonce,
            rule.primaryTokenAddress,
            primaryTokenAmount,
            rule.secondaryTokenAddress,
            secondaryTokenAmount,
            keccak256(bytes(mainId)),
            keccak256(bytes(secondId)),
            keccak256(bytes(refId))
        ));
    }

    function _pageSize(uint256 total, uint256 offset, uint256 limit) private pure returns (uint256 size) {
        if (limit == 0 || limit > MAX_PAGE_SIZE) revert InvalidPageSize();
        if (offset >= total) return 0;
        uint256 remaining = total - offset;
        return remaining < limit ? remaining : limit;
    }

    function _latestPageSize(uint256 total, uint256 maxCount) private pure returns (uint256 size) {
        if (maxCount == 0 || maxCount > MAX_PAGE_SIZE) revert InvalidPageSize();
        return total < maxCount ? total : maxCount;
    }

    function _setPayouts(address[] memory wallets, uint16[] memory sharesBps) private {
        uint256 count = wallets.length;
        if (count == 0 || count > MAX_PAYOUT_WALLETS || sharesBps.length != count) {
            revert InvalidPayoutConfiguration();
        }
        if (sharesBps[count - 1] != 0) revert InvalidPayoutConfiguration();
        uint256 explicitTotal;
        for (uint256 index; index < count; ++index) {
            if (wallets[index] == address(0)) revert InvalidAddress();
            for (uint256 previous; previous < index; ++previous) {
                if (wallets[index] == wallets[previous]) revert DuplicatePayoutWallet();
            }
            if (index < count - 1) {
                if (sharesBps[index] == 0) revert InvalidPayoutConfiguration();
                explicitTotal += sharesBps[index];
            }
        }
        if (explicitTotal >= BPS_DENOMINATOR) revert InvalidPayoutConfiguration();
        delete _payoutWallets;
        delete _payoutSharesBps;
        for (uint256 index; index < count; ++index) {
            _payoutWallets.push(wallets[index]);
            _payoutSharesBps.push(sharesBps[index]);
        }
        payoutConfigHash = keccak256(abi.encode(wallets, sharesBps));
        emit PayoutConfigurationUpdated(payoutConfigHash, wallets, sharesBps);
    }

    function _transferExact(IERC20 token, address wallet, uint256 tokenAmount) private {
        uint256 balanceBefore = token.balanceOf(wallet);
        token.safeTransferFrom(msg.sender, wallet, tokenAmount);
        uint256 balanceAfter = token.balanceOf(wallet);
        if (wallet == msg.sender) {
            if (balanceAfter != balanceBefore) revert TokenTransferAmountMismatch();
        } else if (balanceAfter - balanceBefore != tokenAmount) {
            revert TokenTransferAmountMismatch();
        }
    }
}

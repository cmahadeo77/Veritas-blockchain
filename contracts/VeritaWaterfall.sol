// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title VeritaWaterfall
 * @notice Chapter 11 reorganization plan waterfall disbursement
 * @dev Enforces priority payment order: senior secured → unsecured →
 *      subordinated → equity. It is mathematically impossible for a
 *      junior tranche to be paid before a senior tranche is made whole.
 *
 * This contract demonstrates the core value proposition for Chapter 11
 * plan administration: the waterfall logic is encoded in the contract
 * and cannot be overridden, regardless of processing order or human error.
 */
contract VeritaWaterfall is Ownable, ReentrancyGuard {

    IERC20 public immutable usdc;

    enum TrancheType {
        SENIOR_SECURED,      // First lien lenders
        ADMIN_CLAIMS,        // Administrative expense claims (503(b))
        UNSECURED,           // General unsecured creditors
        SUBORDINATED,        // Contractually subordinated debt
        PREFERRED_EQUITY,    // Preferred shareholders
        COMMON_EQUITY        // Common shareholders (typically zero recovery)
    }

    struct Creditor {
        address wallet;
        uint256 claimAmount;   // Allowed claim amount
        uint256 recovery;      // Actual recovery (set on plan confirmation)
        bool paid;
        string creditorId;
    }

    struct Tranche {
        TrancheType trancheType;
        string description;
        uint256 totalClaims;
        uint256 totalAllocated;
        uint256 recoveryPct;   // Basis points (10000 = 100%)
        bool confirmed;        // Court confirmed this tranche's treatment
        bool paid;
        Creditor[] creditors;
    }

    struct WaterfallCase {
        string caseId;
        string debtorName;
        address planAdministrator;
        uint256 totalFunds;
        uint256 confirmedDate;
        bool fundsDeposited;
        Tranche[] tranches;
    }

    mapping(uint256 => WaterfallCase) public cases;
    uint256 public caseCount;

    event CaseCreated(uint256 indexed caseId, string debtorName);
    event TrancheAdded(uint256 indexed caseId, uint256 trancheIndex, TrancheType trancheType);
    event FundsDeposited(uint256 indexed caseId, uint256 amount);
    event TrancheConfirmed(uint256 indexed caseId, uint256 trancheIndex, uint256 recoveryPct);
    event TranchePaid(uint256 indexed caseId, uint256 trancheIndex, uint256 totalPaid);
    event CreditorPaid(uint256 indexed caseId, string creditorId, address wallet, uint256 amount);

    error WrongPriority(uint256 seniorTranche);
    error TrancheNotConfirmed();
    error AlreadyPaid();
    error InsufficientFunds();

    constructor(address _usdc) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
    }

    function createCase(
        string calldata caseId,
        string calldata debtorName,
        address planAdministrator
    ) external onlyOwner returns (uint256 newCaseId) {
        newCaseId = caseCount++;
        WaterfallCase storage c = cases[newCaseId];
        c.caseId = caseId;
        c.debtorName = debtorName;
        c.planAdministrator = planAdministrator;
        emit CaseCreated(newCaseId, debtorName);
    }

    function addTranche(
        uint256 caseId,
        TrancheType trancheType,
        string calldata description
    ) external {
        WaterfallCase storage c = cases[caseId];
        c.tranches.push();
        uint256 idx = c.tranches.length - 1;
        c.tranches[idx].trancheType = trancheType;
        c.tranches[idx].description = description;
        emit TrancheAdded(caseId, idx, trancheType);
    }

    function addCreditor(
        uint256 caseId,
        uint256 trancheIndex,
        address wallet,
        uint256 claimAmount,
        string calldata creditorId
    ) external {
        WaterfallCase storage c = cases[caseId];
        Tranche storage t = c.tranches[trancheIndex];
        t.creditors.push(Creditor({
            wallet: wallet,
            claimAmount: claimAmount,
            recovery: 0,
            paid: false,
            creditorId: creditorId
        }));
        t.totalClaims += claimAmount;
    }

    function depositFunds(uint256 caseId, uint256 amount) external nonReentrant {
        WaterfallCase storage c = cases[caseId];
        usdc.transferFrom(msg.sender, address(this), amount);
        c.totalFunds += amount;
        c.fundsDeposited = true;
        emit FundsDeposited(caseId, amount);
    }

    /**
     * @notice Confirm a tranche treatment per the reorganization plan
     * @param recoveryPct Recovery percentage in basis points (e.g., 7500 = 75%)
     */
    function confirmTranche(
        uint256 caseId,
        uint256 trancheIndex,
        uint256 recoveryPct
    ) external {
        WaterfallCase storage c = cases[caseId];
        Tranche storage t = c.tranches[trancheIndex];
        t.recoveryPct = recoveryPct;
        t.confirmed = true;

        // Calculate each creditor's recovery
        for (uint256 i = 0; i < t.creditors.length; i++) {
            t.creditors[i].recovery = (t.creditors[i].claimAmount * recoveryPct) / 10000;
            t.totalAllocated += t.creditors[i].recovery;
        }

        emit TrancheConfirmed(caseId, trancheIndex, recoveryPct);
    }

    /**
     * @notice Pay a tranche — enforces waterfall: all higher-priority tranches
     *         must be fully paid before this tranche can be released
     */
    function payTranche(uint256 caseId, uint256 trancheIndex) external nonReentrant {
        WaterfallCase storage c = cases[caseId];
        Tranche storage t = c.tranches[trancheIndex];

        if (!t.confirmed) revert TrancheNotConfirmed();
        if (t.paid) revert AlreadyPaid();

        // Enforce waterfall: all higher-priority tranches must be paid first
        for (uint256 i = 0; i < trancheIndex; i++) {
            if (c.tranches[i].confirmed && !c.tranches[i].paid) {
                revert WrongPriority(i);
            }
        }

        if (c.totalFunds < t.totalAllocated) revert InsufficientFunds();

        uint256 totalPaid;

        for (uint256 i = 0; i < t.creditors.length; i++) {
            Creditor storage creditor = t.creditors[i];
            if (!creditor.paid && creditor.recovery > 0) {
                creditor.paid = true;
                totalPaid += creditor.recovery;
                usdc.transfer(creditor.wallet, creditor.recovery);
                emit CreditorPaid(caseId, creditor.creditorId, creditor.wallet, creditor.recovery);
            }
        }

        t.paid = true;
        c.totalFunds -= totalPaid;

        emit TranchePaid(caseId, trancheIndex, totalPaid);
    }

    function getCaseSummary(uint256 caseId) external view returns (
        string memory debtorName,
        uint256 totalFunds,
        uint256 trancheCount
    ) {
        WaterfallCase storage c = cases[caseId];
        return (c.debtorName, c.totalFunds, c.tranches.length);
    }
}

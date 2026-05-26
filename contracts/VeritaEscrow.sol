// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title VeritaEscrow
 * @notice Escrow contract for legal administration disbursements
 * @dev Simulates Verita-style trustee escrow for Chapter 7, class actions,
 *      and structured settlement payouts using USDC on Polygon.
 *
 * Use cases demonstrated:
 * - Class action settlement: multiple claimants, pro-rata disbursement
 * - Chapter 7 trustee: hold funds until court-order release condition met
 * - Structured settlement: scheduled payout to single beneficiary
 *
 * Production note: In a real deployment, the releaseCondition would be
 * fulfilled by a Valid8 oracle publishing verified claim status on-chain,
 * rather than the administrator calling releaseFunds() directly.
 */
contract VeritaEscrow is Ownable, ReentrancyGuard {

    // ── State ──────────────────────────────────────────────────────────────

    IERC20 public immutable usdc;

    enum EscrowState { OPEN, FUNDED, RELEASED, CANCELLED }

    struct Claimant {
        address wallet;
        uint256 amount;       // USDC amount (6 decimals)
        bool paid;
        string claimId;       // External reference (court case ID, claim number)
    }

    struct EscrowAccount {
        string caseId;         // e.g. "MDL-2023-004", "BK-2024-01234"
        string caseType;       // "CLASS_ACTION" | "CHAPTER_7" | "CHAPTER_11" | "MASS_TORT"
        address administrator;
        uint256 totalDeposited;
        uint256 totalAllocated;
        EscrowState state;
        bool releaseApproved;  // Simulates court order / Valid8 verification
        Claimant[] claimants;
        uint256 createdAt;
        uint256 releasedAt;
    }

    mapping(uint256 => EscrowAccount) public escrows;
    uint256 public escrowCount;

    // ── Events ────────────────────────────────────────────────────────────

    event EscrowCreated(uint256 indexed escrowId, string caseId, string caseType, address administrator);
    event FundsDeposited(uint256 indexed escrowId, uint256 amount, address depositor);
    event ClaimantRegistered(uint256 indexed escrowId, address claimant, uint256 amount, string claimId);
    event ReleaseApproved(uint256 indexed escrowId, address approvedBy);
    event FundsDisbursed(uint256 indexed escrowId, uint256 claimantCount, uint256 totalPaid);
    event SinglePayment(uint256 indexed escrowId, address claimant, uint256 amount, string claimId);
    event EscrowCancelled(uint256 indexed escrowId);

    // ── Errors ────────────────────────────────────────────────────────────

    error EscrowNotFound();
    error NotAdministrator();
    error EscrowNotFunded();
    error ReleaseNotApproved();
    error InsufficientEscrowBalance();
    error AlreadyPaid();
    error InvalidState();

    // ── Constructor ───────────────────────────────────────────────────────

    constructor(address _usdc) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
    }

    // ── Core functions ────────────────────────────────────────────────────

    /**
     * @notice Create a new escrow account for a legal case
     * @param caseId External case identifier (court docket number, etc.)
     * @param caseType Type of legal proceeding
     * @param administrator The Verita administrator managing this case
     */
    function createEscrow(
        string calldata caseId,
        string calldata caseType,
        address administrator
    ) external onlyOwner returns (uint256 escrowId) {
        escrowId = escrowCount++;

        EscrowAccount storage escrow = escrows[escrowId];
        escrow.caseId = caseId;
        escrow.caseType = caseType;
        escrow.administrator = administrator;
        escrow.state = EscrowState.OPEN;
        escrow.createdAt = block.timestamp;

        emit EscrowCreated(escrowId, caseId, caseType, administrator);
    }

    /**
     * @notice Deposit USDC into an escrow account
     * @param escrowId The escrow to fund
     * @param amount USDC amount (6 decimals — 1 USDC = 1_000_000)
     */
    function depositFunds(uint256 escrowId, uint256 amount) external nonReentrant {
        EscrowAccount storage escrow = _getEscrow(escrowId);

        if (escrow.state != EscrowState.OPEN && escrow.state != EscrowState.FUNDED) {
            revert InvalidState();
        }

        usdc.transferFrom(msg.sender, address(this), amount);

        escrow.totalDeposited += amount;
        escrow.state = EscrowState.FUNDED;

        emit FundsDeposited(escrowId, amount, msg.sender);
    }

    /**
     * @notice Register a claimant and their allocated amount
     * @dev In production, claimant list would be verified by Valid8 oracle
     * @param escrowId The escrow account
     * @param wallet Claimant's wallet address (Circle custodial or self-custody)
     * @param amount USDC allocated to this claimant
     * @param claimId External claim identifier
     */
    function registerClaimant(
        uint256 escrowId,
        address wallet,
        uint256 amount,
        string calldata claimId
    ) external {
        EscrowAccount storage escrow = _getEscrow(escrowId);
        _requireAdministrator(escrow);

        if (escrow.state != EscrowState.FUNDED) revert EscrowNotFunded();
        if (escrow.totalAllocated + amount > escrow.totalDeposited) {
            revert InsufficientEscrowBalance();
        }

        escrow.claimants.push(Claimant({
            wallet: wallet,
            amount: amount,
            paid: false,
            claimId: claimId
        }));

        escrow.totalAllocated += amount;

        emit ClaimantRegistered(escrowId, wallet, amount, claimId);
    }

    /**
     * @notice Approve release of funds (simulates court order confirmation)
     * @dev In production, this would be triggered by a Valid8 oracle
     *      publishing verified case completion status on-chain
     */
    function approveRelease(uint256 escrowId) external {
        EscrowAccount storage escrow = _getEscrow(escrowId);
        _requireAdministrator(escrow);

        escrow.releaseApproved = true;

        emit ReleaseApproved(escrowId, msg.sender);
    }

    /**
     * @notice Disburse USDC to all registered claimants in one transaction
     * @dev Gas-efficient batch transfer — handles 500+ claimants per tx on Polygon
     */
    function releaseFunds(uint256 escrowId) external nonReentrant {
        EscrowAccount storage escrow = _getEscrow(escrowId);
        _requireAdministrator(escrow);

        if (!escrow.releaseApproved) revert ReleaseNotApproved();
        if (escrow.state != EscrowState.FUNDED) revert EscrowNotFunded();

        uint256 totalPaid;
        uint256 claimantCount = escrow.claimants.length;

        for (uint256 i = 0; i < claimantCount; i++) {
            Claimant storage claimant = escrow.claimants[i];

            if (!claimant.paid && claimant.amount > 0) {
                claimant.paid = true;
                totalPaid += claimant.amount;

                usdc.transfer(claimant.wallet, claimant.amount);

                emit SinglePayment(escrowId, claimant.wallet, claimant.amount, claimant.claimId);
            }
        }

        escrow.state = EscrowState.RELEASED;
        escrow.releasedAt = block.timestamp;

        emit FundsDisbursed(escrowId, claimantCount, totalPaid);
    }

    /**
     * @notice Emergency withdrawal by owner (court-ordered reversal simulation)
     */
    function emergencyWithdraw(uint256 escrowId, address recipient) external onlyOwner {
        EscrowAccount storage escrow = _getEscrow(escrowId);

        uint256 balance = escrow.totalDeposited - escrow.totalAllocated;
        escrow.state = EscrowState.CANCELLED;

        usdc.transfer(recipient, balance);

        emit EscrowCancelled(escrowId);
    }

    // ── View functions ────────────────────────────────────────────────────

    function getEscrowSummary(uint256 escrowId) external view returns (
        string memory caseId,
        string memory caseType,
        uint256 totalDeposited,
        uint256 totalAllocated,
        uint256 claimantCount,
        EscrowState state,
        bool releaseApproved
    ) {
        EscrowAccount storage escrow = _getEscrow(escrowId);
        return (
            escrow.caseId,
            escrow.caseType,
            escrow.totalDeposited,
            escrow.totalAllocated,
            escrow.claimants.length,
            escrow.state,
            escrow.releaseApproved
        );
    }

    function getClaimant(uint256 escrowId, uint256 index) external view returns (
        address wallet,
        uint256 amount,
        bool paid,
        string memory claimId
    ) {
        Claimant storage c = escrows[escrowId].claimants[index];
        return (c.wallet, c.amount, c.paid, c.claimId);
    }

    // ── Internal ──────────────────────────────────────────────────────────

    function _getEscrow(uint256 escrowId) internal view returns (EscrowAccount storage) {
        if (escrowId >= escrowCount) revert EscrowNotFound();
        return escrows[escrowId];
    }

    function _requireAdministrator(EscrowAccount storage escrow) internal view {
        if (msg.sender != escrow.administrator && msg.sender != owner()) {
            revert NotAdministrator();
        }
    }
}

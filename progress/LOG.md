# Work Log - Veritas-blockchain

Newest first. Earlier entries are reconstructed from git history.

## 2026-11-23

- Added `contracts/MockUSDC.sol` and Hardhat tests for escrow and waterfall (14 passing).
- Testing surfaced contract bugs (emergency withdraw repeatable, open waterfall setters); logged as M1.5.
- Next: `scripts/deploy.js`, then the M1.5 fixes.

## 2026-10-20

- Added `progress/` folder (status, roadmap, log).
- Audited README against committed code; recorded gaps in STATUS.md and turned them into roadmap items.
- Next: Add `contracts/MockUSDC.sol`

## 2026-05-26

- privacy: replace company name with generic company type
- init: Veritas Blockchain sandbox — escrow, waterfall contracts, frontend

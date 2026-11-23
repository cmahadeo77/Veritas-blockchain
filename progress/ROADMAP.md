# Roadmap - Veritas-blockchain

_Last updated: 2026-11-23_

## M1 - Make the README true

- [x] Add `contracts/MockUSDC.sol`
- [ ] Add `scripts/deploy.js`
- [ ] Add `scripts/demo-waterfall.js`
- [x] Add Hardhat tests for escrow + waterfall (14 passing)

## M1.5 - Contract fixes (found while writing tests)

- [ ] `VeritaEscrow.emergencyWithdraw` has no state check: calling it twice on one escrow pays out again from other escrows' funds. Require state OPEN/FUNDED and zero the balance.
- [ ] `VeritaWaterfall.addTranche` / `addCreditor` / `confirmTranche` have no access control: anyone can add themselves as a creditor or set recoveries. Restrict to owner or plan administrator.
- [ ] `confirmTranche` can be called again and double-counts `totalAllocated`; block re-confirmation.
- [ ] `payTranche` only enforces priority over *confirmed* senior tranches, so an unconfirmed senior tranche can be skipped.
- [ ] Use `SafeERC20` for transfers.

## M2 - Testnet

- [ ] Deploy to Polygon Amoy
- [ ] Fill in contract address table
- [ ] Record a demo disbursement tx hash in README

## M3 - Frontend

- [ ] Connect wallet + read escrow state
- [ ] Trigger release from UI
- [ ] Show waterfall tranche payouts

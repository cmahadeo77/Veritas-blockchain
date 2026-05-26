/**
 * demo-disbursement.js
 *
 * Simulates a class action settlement disbursement on Polygon Amoy testnet.
 *
 * Scenario: "Rodriguez v. MegaCorp" — wage & hour class action
 * - 5 claimants with varying settlement amounts
 * - Funds held in VeritaEscrow until administrator approves release
 * - All claimants paid in a single transaction
 *
 * Run: npx hardhat run scripts/demo-disbursement.js --network polygonAmoy
 */

const { ethers } = require("hardhat");

async function main() {
  const [deployer, administrator, ...signers] = await ethers.getSigners();

  console.log("\n=== Verita Class Action Disbursement Demo ===");
  console.log("Network: Polygon Amoy Testnet");
  console.log("Administrator:", administrator.address);
  console.log("");

  // ── Get deployed contracts ─────────────────────────────────────────────
  const escrowAddress   = process.env.ESCROW_ADDRESS;
  const usdcAddress     = process.env.USDC_ADDRESS;

  if (!escrowAddress || !usdcAddress) {
    console.error("Set ESCROW_ADDRESS and USDC_ADDRESS in .env");
    process.exit(1);
  }

  const VeritaEscrow = await ethers.getContractFactory("VeritaEscrow");
  const escrow = VeritaEscrow.attach(escrowAddress);

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = MockUSDC.attach(usdcAddress);

  // ── Create escrow for this case ────────────────────────────────────────
  console.log("Step 1: Creating escrow for Rodriguez v. MegaCorp");
  const createTx = await escrow.createEscrow(
    "CASE-2024-CLASS-001",
    "CLASS_ACTION",
    administrator.address
  );
  const createReceipt = await createTx.wait();
  const escrowId = 0; // First escrow
  console.log("  ✓ Escrow created | TX:", createReceipt.hash);

  // ── Fund the escrow ────────────────────────────────────────────────────
  const totalSettlement = ethers.parseUnits("1000", 6); // $1,000 USDC
  console.log("\nStep 2: Funding escrow with $1,000 USDC");
  await usdc.approve(escrowAddress, totalSettlement);
  const depositTx = await escrow.depositFunds(escrowId, totalSettlement);
  await depositTx.wait();
  console.log("  ✓ $1,000 USDC deposited | TX:", depositTx.hash);

  // ── Register claimants ─────────────────────────────────────────────────
  console.log("\nStep 3: Registering 5 claimants");

  const claimants = [
    { address: signers[0].address, amount: "250", id: "CLM-001", name: "Maria R." },
    { address: signers[1].address, amount: "200", id: "CLM-002", name: "James T." },
    { address: signers[2].address, amount: "150", id: "CLM-003", name: "Sarah K." },
    { address: signers[3].address, amount: "225", id: "CLM-004", name: "David L." },
    { address: signers[4].address, amount: "175", id: "CLM-005", name: "Ana M." },
  ];

  for (const c of claimants) {
    const amount = ethers.parseUnits(c.amount, 6);
    const tx = await escrow.connect(administrator).registerClaimant(
      escrowId,
      c.address,
      amount,
      c.id
    );
    await tx.wait();
    console.log(`  ✓ ${c.name} registered — $${c.amount} USDC`);
  }

  // ── Approve release (simulates court order) ────────────────────────────
  console.log("\nStep 4: Court order received — approving release");
  const approveTx = await escrow.connect(administrator).approveRelease(escrowId);
  await approveTx.wait();
  console.log("  ✓ Release approved | TX:", approveTx.hash);

  // ── Check balances before disbursement ────────────────────────────────
  console.log("\nStep 5: Claimant balances BEFORE disbursement:");
  for (const c of claimants) {
    const balance = await usdc.balanceOf(c.address);
    console.log(`  ${c.name}: $${ethers.formatUnits(balance, 6)} USDC`);
  }

  // ── Release funds ──────────────────────────────────────────────────────
  console.log("\nStep 6: Releasing funds to all claimants");
  const releaseTx = await escrow.connect(administrator).releaseFunds(escrowId);
  const releaseReceipt = await releaseTx.wait();
  console.log("  ✓ Disbursement complete | TX:", releaseReceipt.hash);
  console.log("  Gas used:", releaseReceipt.gasUsed.toString());

  // ── Check balances after disbursement ─────────────────────────────────
  console.log("\nStep 7: Claimant balances AFTER disbursement:");
  for (const c of claimants) {
    const balance = await usdc.balanceOf(c.address);
    console.log(`  ✓ ${c.name}: $${ethers.formatUnits(balance, 6)} USDC`);
  }

  // ── Summary ────────────────────────────────────────────────────────────
  const summary = await escrow.getEscrowSummary(escrowId);
  console.log("\n=== Disbursement Summary ===");
  console.log("Case ID:", summary.caseId);
  console.log("Total disbursed: $" + ethers.formatUnits(summary.totalAllocated, 6));
  console.log("Claimants paid:", summary.claimantCount.toString());
  console.log("State:", ["OPEN","FUNDED","RELEASED","CANCELLED"][summary.state]);
  console.log("\nView on Polygon Amoy Explorer:");
  console.log("https://amoy.polygonscan.com/tx/" + releaseReceipt.hash);
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });

const { expect } = require("chai");
const { ethers } = require("hardhat");

const usd = (n) => ethers.parseUnits(String(n), 6);
const STATE = { OPEN: 0, FUNDED: 1, RELEASED: 2, CANCELLED: 3 };

describe("VeritaEscrow", function () {
  let usdc, escrow, owner, admin, outsider, a, b;

  beforeEach(async function () {
    [owner, admin, outsider, a, b] = await ethers.getSigners();
    usdc = await ethers.deployContract("MockUSDC");
    escrow = await ethers.deployContract("VeritaEscrow", [await usdc.getAddress()]);
    await usdc.mint(owner.address, usd(10000));
    await usdc.approve(await escrow.getAddress(), usd(10000));
    await escrow.createEscrow("CASE-001", "CLASS_ACTION", admin.address);
  });

  it("only the owner can create an escrow", async function () {
    await expect(escrow.connect(outsider).createEscrow("X", "CLASS_ACTION", admin.address))
      .to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
  });

  it("funds, registers claimants and pays everyone in one release", async function () {
    await escrow.depositFunds(0, usd(1000));
    await escrow.connect(admin).registerClaimant(0, a.address, usd(600), "CLM-A");
    await escrow.connect(admin).registerClaimant(0, b.address, usd(400), "CLM-B");
    await escrow.connect(admin).approveRelease(0);

    await expect(escrow.connect(admin).releaseFunds(0))
      .to.emit(escrow, "FundsDisbursed").withArgs(0, 2, usd(1000));

    expect(await usdc.balanceOf(a.address)).to.equal(usd(600));
    expect(await usdc.balanceOf(b.address)).to.equal(usd(400));
    const summary = await escrow.getEscrowSummary(0);
    expect(summary.state).to.equal(STATE.RELEASED);
  });

  it("blocks release before approval", async function () {
    await escrow.depositFunds(0, usd(100));
    await escrow.connect(admin).registerClaimant(0, a.address, usd(100), "CLM-A");
    await expect(escrow.connect(admin).releaseFunds(0))
      .to.be.revertedWithCustomError(escrow, "ReleaseNotApproved");
  });

  it("rejects allocations above the deposited balance", async function () {
    await escrow.depositFunds(0, usd(100));
    await expect(escrow.connect(admin).registerClaimant(0, a.address, usd(101), "CLM-A"))
      .to.be.revertedWithCustomError(escrow, "InsufficientEscrowBalance");
  });

  it("rejects claimant registration on an unfunded escrow", async function () {
    await expect(escrow.connect(admin).registerClaimant(0, a.address, usd(1), "CLM-A"))
      .to.be.revertedWithCustomError(escrow, "EscrowNotFunded");
  });

  it("stops non-administrators from registering, approving or releasing", async function () {
    await escrow.depositFunds(0, usd(100));
    await expect(escrow.connect(outsider).registerClaimant(0, a.address, usd(1), "X"))
      .to.be.revertedWithCustomError(escrow, "NotAdministrator");
    await expect(escrow.connect(outsider).approveRelease(0))
      .to.be.revertedWithCustomError(escrow, "NotAdministrator");
    await expect(escrow.connect(outsider).releaseFunds(0))
      .to.be.revertedWithCustomError(escrow, "NotAdministrator");
  });

  it("cannot release twice", async function () {
    await escrow.depositFunds(0, usd(100));
    await escrow.connect(admin).registerClaimant(0, a.address, usd(100), "CLM-A");
    await escrow.connect(admin).approveRelease(0);
    await escrow.connect(admin).releaseFunds(0);
    await expect(escrow.connect(admin).releaseFunds(0))
      .to.be.revertedWithCustomError(escrow, "EscrowNotFunded");
  });

  it("reverts on an unknown escrow id", async function () {
    await expect(escrow.getEscrowSummary(99))
      .to.be.revertedWithCustomError(escrow, "EscrowNotFound");
  });

  it("emergency withdraw returns only the unallocated balance and cancels", async function () {
    await escrow.depositFunds(0, usd(1000));
    await escrow.connect(admin).registerClaimant(0, a.address, usd(300), "CLM-A");
    const before = await usdc.balanceOf(outsider.address);
    await escrow.emergencyWithdraw(0, outsider.address);
    expect((await usdc.balanceOf(outsider.address)) - before).to.equal(usd(700));
    const summary = await escrow.getEscrowSummary(0);
    expect(summary.state).to.equal(STATE.CANCELLED);
  });
});

const { expect } = require("chai");
const { ethers } = require("hardhat");

const usd = (n) => ethers.parseUnits(String(n), 6);
const TRANCHE = { SENIOR_SECURED: 0, UNSECURED: 2 };

describe("VeritaWaterfall", function () {
  let usdc, wf, owner, planAdmin, senior1, senior2, junior1;

  beforeEach(async function () {
    [owner, planAdmin, senior1, senior2, junior1] = await ethers.getSigners();
    usdc = await ethers.deployContract("MockUSDC");
    wf = await ethers.deployContract("VeritaWaterfall", [await usdc.getAddress()]);
    await usdc.mint(owner.address, usd(10000));
    await usdc.approve(await wf.getAddress(), usd(10000));

    await wf.createCase("BK-2026-001", "Example Debtor LLC", planAdmin.address);
    await wf.addTranche(0, TRANCHE.SENIOR_SECURED, "Senior secured lenders");
    await wf.addTranche(0, TRANCHE.UNSECURED, "General unsecured creditors");
    await wf.addCreditor(0, 0, senior1.address, usd(500), "SR-1");
    await wf.addCreditor(0, 0, senior2.address, usd(300), "SR-2");
    await wf.addCreditor(0, 1, junior1.address, usd(400), "UNS-1");
    await wf.depositFunds(0, usd(1000));
  });

  it("only the owner can create a case", async function () {
    await expect(wf.connect(planAdmin).createCase("X", "Y", planAdmin.address))
      .to.be.revertedWithCustomError(wf, "OwnableUnauthorizedAccount");
  });

  it("refuses to pay a junior tranche before the senior tranche", async function () {
    await wf.confirmTranche(0, 0, 10000);
    await wf.confirmTranche(0, 1, 5000);
    await expect(wf.payTranche(0, 1))
      .to.be.revertedWithCustomError(wf, "WrongPriority").withArgs(0);
  });

  it("pays senior in full, then junior at its confirmed recovery", async function () {
    await wf.confirmTranche(0, 0, 10000); // 100%
    await wf.confirmTranche(0, 1, 5000);  // 50%

    await expect(wf.payTranche(0, 0)).to.emit(wf, "TranchePaid").withArgs(0, 0, usd(800));
    await wf.payTranche(0, 1);

    expect(await usdc.balanceOf(senior1.address)).to.equal(usd(500));
    expect(await usdc.balanceOf(senior2.address)).to.equal(usd(300));
    expect(await usdc.balanceOf(junior1.address)).to.equal(usd(200));
    const summary = await wf.getCaseSummary(0);
    expect(summary.totalFunds).to.equal(0);
  });

  it("rejects unconfirmed and already-paid tranches", async function () {
    await expect(wf.payTranche(0, 0)).to.be.revertedWithCustomError(wf, "TrancheNotConfirmed");
    await wf.confirmTranche(0, 0, 10000);
    await wf.payTranche(0, 0);
    await expect(wf.payTranche(0, 0)).to.be.revertedWithCustomError(wf, "AlreadyPaid");
  });

  it("rejects a tranche the remaining funds cannot cover", async function () {
    await wf.confirmTranche(0, 0, 10000);
    await wf.confirmTranche(0, 1, 10000); // needs 400, only 200 left after senior
    await wf.payTranche(0, 0);
    await expect(wf.payTranche(0, 1)).to.be.revertedWithCustomError(wf, "InsufficientFunds");
  });
});

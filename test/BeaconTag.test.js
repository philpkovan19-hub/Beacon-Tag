const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BeaconTag", function () {
  let bt, owner, a, b, c;
  const FEE = ethers.parseEther("0.001");

  beforeEach(async () => {
    [owner, a, b, c] = await ethers.getSigners();
    const F = await ethers.getContractFactory("BeaconTag");
    bt = await F.deploy();
    await bt.waitForDeployment();
  });

  it("claimTag requires fee", async () => {
    await expect(bt.connect(a).claimTag("solidity-dev", "")).to.be.revertedWith("fee");
  });

  it("rejects bad length", async () => {
    await expect(bt.connect(a).claimTag("ab", "", { value: FEE })).to.be.revertedWith("bad length");
    const long = "a".repeat(33);
    await expect(bt.connect(a).claimTag(long, "", { value: FEE })).to.be.revertedWith("bad length");
  });

  it("rejects uppercase / bad chars", async () => {
    await expect(bt.connect(a).claimTag("SolidityDev", "", { value: FEE })).to.be.revertedWith("bad char");
    await expect(bt.connect(a).claimTag("hello world", "", { value: FEE })).to.be.revertedWith("bad char");
    await expect(bt.connect(a).claimTag("hello_world", "", { value: FEE })).to.be.revertedWith("bad char");
  });

  it("accepts lowercase + digits + hyphens", async () => {
    await expect(bt.connect(a).claimTag("web3-2024", "hi", { value: FEE })).to.emit(bt, "TagClaimed");
  });

  it("duplicate claim rejected", async () => {
    await bt.connect(a).claimTag("rust", "", { value: FEE });
    await expect(bt.connect(a).claimTag("rust", "", { value: FEE })).to.be.revertedWith("already");
  });

  it("releaseTag refunds correctly (50% default)", async () => {
    await bt.connect(a).claimTag("go", "", { value: FEE });
    const before = await ethers.provider.getBalance(a.address);
    const tx = await bt.connect(a).releaseTag("go");
    const rec = await tx.wait();
    const gas = rec.gasUsed * rec.gasPrice;
    const after = await ethers.provider.getBalance(a.address);
    const expected = FEE / 2n - gas;
    expect(after - before).to.equal(expected);
  });

  it("releaseTag removes from holder list", async () => {
    await bt.connect(a).claimTag("x", "", { value: FEE });
    await bt.connect(b).claimTag("x", "", { value: FEE });
    await bt.connect(a).releaseTag("x");
    const holders = await bt.getHoldersOfTag("x");
    expect(holders).to.deep.equal([b.address]);
    expect(await bt.hasTag(a.address, "x")).to.equal(false);
    expect(await bt.hasTag(b.address, "x")).to.equal(true);
  });

  it("updateBio bounds", async () => {
    await bt.connect(a).updateBio("hi there");
    expect(await bt.getBio(a.address)).to.equal("hi there");
    const long = "z".repeat(201);
    await expect(bt.connect(a).updateBio(long)).to.be.revertedWith("bio too long");
  });

  it("getHoldersOfTag returns all holders", async () => {
    await bt.connect(a).claimTag("py", "", { value: FEE });
    await bt.connect(b).claimTag("py", "", { value: FEE });
    await bt.connect(c).claimTag("py", "", { value: FEE });
    const h = await bt.getHoldersOfTag("py");
    expect(h.length).to.equal(3);
    expect(h).to.include.members([a.address, b.address, c.address]);
  });

  it("getAllTags dedupes across users", async () => {
    await bt.connect(a).claimTag("js", "", { value: FEE });
    await bt.connect(b).claimTag("js", "", { value: FEE });
    await bt.connect(a).claimTag("ts", "", { value: FEE });
    const all = await bt.getAllTags();
    expect(all.length).to.equal(2);
    expect(await bt.tagCount()).to.equal(2n);
  });

  it("bioIfNew only sets on first time; empty string skips", async () => {
    await bt.connect(a).claimTag("js", "first bio", { value: FEE });
    expect(await bt.getBio(a.address)).to.equal("first bio");
    await bt.connect(a).claimTag("ts", "should not overwrite", { value: FEE });
    expect(await bt.getBio(a.address)).to.equal("first bio");
  });

  it("admin bounds", async () => {
    await expect(bt.connect(a).setTagFee(1)).to.be.reverted;
    await expect(bt.setTagFee(ethers.parseEther("2"))).to.be.revertedWith("fee too high");
    await expect(bt.setRefundBps(10001)).to.be.revertedWith("bps too high");
    await bt.setTagFee(ethers.parseEther("0.5"));
    expect(await bt.tagFee()).to.equal(ethers.parseEther("0.5"));
  });

  it("pause blocks claim and bio", async () => {
    await bt.pause();
    await expect(bt.connect(a).claimTag("nope", "", { value: FEE })).to.be.reverted;
    await expect(bt.connect(a).updateBio("x")).to.be.reverted;
    await bt.unpause();
    await bt.connect(a).claimTag("ok", "", { value: FEE });
  });

  it("withdrawFees works", async () => {
    await bt.connect(a).claimTag("a1", "", { value: FEE });
    await bt.connect(b).claimTag("b1", "", { value: FEE });
    const bal = await ethers.provider.getBalance(await bt.getAddress());
    await bt.withdrawFees(owner.address, bal);
    expect(await ethers.provider.getBalance(await bt.getAddress())).to.equal(0n);
  });

  it("getTagsOfUser reflects claims and releases", async () => {
    await bt.connect(a).claimTag("one", "", { value: FEE });
    await bt.connect(a).claimTag("two", "", { value: FEE });
    let ts = await bt.getTagsOfUser(a.address);
    expect(ts.length).to.equal(2);
    await bt.connect(a).releaseTag("one");
    ts = await bt.getTagsOfUser(a.address);
    expect(ts).to.deep.equal(["two"]);
  });
});

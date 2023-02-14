const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("BondWrapper", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  const INITIAL_BALANCE = 1000;
  const WRAP_AMOUNT = 500;
  const TRANSFER_AMOUNT = 200;
  async function deployTokens() {
    // Contracts are deployed using the first signer/account by default
    const [owner, bondMarket, random1, random2, random3] = await ethers.getSigners();

    const WrappedToken = await ethers.getContractFactory("MockToken");
    const wrappedToken = await WrappedToken.deploy();

    await wrappedToken.mint(owner.address, INITIAL_BALANCE);
    await wrappedToken.mint(random1.address, INITIAL_BALANCE);

    const BondToken = await ethers.getContractFactory("BondWrapper");
    const bondToken = await BondToken.deploy(wrappedToken.address);

    await wrappedToken.approve(bondToken.address, INITIAL_BALANCE);
    await wrappedToken.connect(random1).approve(bondToken.address, INITIAL_BALANCE);

    await bondToken.setBondContract(bondMarket.address, true);

    return { owner, bondMarket, random1, random2, random3, wrappedToken, bondToken };
  }
  
  async function wrapTokens() {
    const { owner, random1, wrappedToken, bondToken } = await loadFixture(deployTokens);
    await bondToken.wrap(WRAP_AMOUNT);
    return { owner, random1, wrappedToken, bondToken }
  }
  
  async function unwrapTokens() {
    const { owner, bondMarket, random2, random3, wrappedToken, bondToken } = await loadFixture(deployTokens);
    await bondToken.wrap(WRAP_AMOUNT);
    await bondToken.transfer(random2.address, TRANSFER_AMOUNT);
    await bondToken.transfer(bondMarket.address, TRANSFER_AMOUNT);
    return { owner, bondMarket, random2, random3, wrappedToken, bondToken }
  }

  describe("deployment", function () {
    it("owner is valid", async function() {
      const { owner, bondToken } = await loadFixture(deployTokens);
      expect(await bondToken.owner()).to.equal(owner.address);
    });
  });

  describe("setBondContract", function() {
    describe("when caller is not the owner", function() {
      it("reverts", async function() {
        const { random1, bondMarket, bondToken } = await loadFixture(deployTokens);
        await expect(bondToken.connect(random1).setBondContract(bondMarket.address, true)).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("when caller is the owner", function() {
      describe("when address is zero", function() {
        it("reverts", async function() {
          const { bondToken } = await loadFixture(deployTokens);
          await expect(bondToken.setBondContract(ethers.constants.AddressZero, true)).to.be.revertedWith("invalid address");
        });
      });

      describe("when address is valid", function() {
        it("whitelist bondContract", async function() {
          const { bondMarket, bondToken } = await loadFixture(deployTokens);
          await bondToken.setBondContract(bondMarket.address, true);
          expect(await bondToken.isBondContract(bondMarket.address)).to.equal(true);
        });

        it("unlist bondContract", async function() {
          const { bondMarket, bondToken } = await loadFixture(deployTokens);
          await bondToken.setBondContract(bondMarket.address, false);
          expect(await bondToken.isBondContract(bondMarket.address)).to.equal(false);
        });
      });
    });
  });

  describe("wrap", function() {
    describe("when caller is not the owner", function() {
      it("reverts", async function() {
        const { random1, bondToken } = await loadFixture(deployTokens);
        await expect(bondToken.connect(random1).wrap(500)).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("when caller is the owner", function() {
      describe("when amount is null", function() {
        it("reverts", async function() {
          const { bondToken } = await loadFixture(deployTokens);
          await expect(bondToken.wrap(0)).to.be.revertedWith("invalid amount");
        });
      });

      describe("when amount is valid", function() {

        it("transfer origin token", async function() {
          const { wrappedToken, bondToken } = await loadFixture(wrapTokens);
          expect(await wrappedToken.balanceOf(bondToken.address)).to.be.equal(500);
        });

        it("receive wrapped token", async function() {
          const { owner, bondToken } = await loadFixture(wrapTokens);
          expect(await bondToken.balanceOf(owner.address)).to.be.equal(500);
        });

        it("emit Wrap event", async function() {
          const { owner, bondToken } = await loadFixture(wrapTokens);
          await expect(bondToken.wrap(500)).to.emit(bondToken, "Wrap").withArgs(owner.address, 500);
        });
      });
    });
  });

  describe("transfer", function() {
    describe("when caller is not whitelisted", function() {
      it("regular transfer", async function() {
        const { random2, bondToken } = await loadFixture(unwrapTokens);
        expect(await bondToken.balanceOf(random2.address)).to.be.equal(200);
      });
    });

    describe("when caller is whitelisted", function() {
      it("burn wrapped tokens", async function() {
        const { bondMarket, random3, bondToken } = await loadFixture(unwrapTokens);
        await bondToken.connect(bondMarket).transfer(random3.address, TRANSFER_AMOUNT);
        expect(await bondToken.balanceOf(bondMarket.address)).to.be.equal(0);
      });

      it("transfer origin token", async function() {
        const { bondMarket, random3, bondToken, wrappedToken } = await loadFixture(unwrapTokens);
        await bondToken.connect(bondMarket).transfer(random3.address, TRANSFER_AMOUNT);
        expect(await wrappedToken.balanceOf(random3.address)).to.be.equal(TRANSFER_AMOUNT);
      });

      it("emit Unwrap event", async function() {
        const { random3, bondMarket, bondToken } = await loadFixture(unwrapTokens);
        await expect(bondToken.connect(bondMarket).transfer(random3.address, TRANSFER_AMOUNT)).to.emit(bondToken, "Unwrap").withArgs(bondMarket.address, random3.address, TRANSFER_AMOUNT);
      });
    });
  });

  describe("transferFrom", function() {
    describe("when caller is whitelisted", function() {
      it("burn wrapped tokens", async function() {
        const { owner, bondMarket, random3, bondToken } = await loadFixture(unwrapTokens);
        await bondToken.connect(bondMarket).approve(owner.address, TRANSFER_AMOUNT);
        await bondToken.transferFrom(bondMarket.address, random3.address, TRANSFER_AMOUNT);
        expect(await bondToken.balanceOf(bondMarket.address)).to.be.equal(0);
      });

      it("transfer origin token", async function() {
        const { owner, bondMarket, random3, bondToken, wrappedToken } = await loadFixture(unwrapTokens);
        await bondToken.connect(bondMarket).approve(owner.address, TRANSFER_AMOUNT);
        await bondToken.transferFrom(bondMarket.address, random3.address, TRANSFER_AMOUNT);
        expect(await wrappedToken.balanceOf(random3.address)).to.be.equal(TRANSFER_AMOUNT);
      });

      it("emit Unwrap event", async function() {
        const { owner, random3, bondMarket, bondToken } = await loadFixture(unwrapTokens);
        await bondToken.connect(bondMarket).approve(owner.address, TRANSFER_AMOUNT);
        await expect(bondToken.transferFrom(bondMarket.address, random3.address, TRANSFER_AMOUNT)).to.emit(bondToken, "Unwrap").withArgs(bondMarket.address, random3.address, TRANSFER_AMOUNT);
      });
    });
  });
});

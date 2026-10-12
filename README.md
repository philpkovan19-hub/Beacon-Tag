# BeaconTag

On-chain skill/interest tag directory for BOT Chain. Claim short slug tags (like `solidity-dev`), attach a bio, and browse holders of any tag.

## Networks
- Bohr Testnet — chainId 968 (0x3C8), RPC https://rpc.bohr.life
- BOT Chain Mainnet — chainId 677 (0x2A5), RPC https://rpc.botchain.ai

## Quickstart
```
npm install
cp .env.example .env    # add PRIVATE_KEY
npx hardhat test
npm run deploy:bohr
```

Update `CONTRACT_ADDRESS` in `frontend/index.html`, then open the file (or deploy via Vercel).

## Contract
- `claimTag(tag, bioIfNew)` payable — fee 0.001 BOT default. Slug: 3-32 lowercase a-z, digits, hyphens.
- `releaseTag(tag)` — 50% refund by default.
- `updateBio(bio)` — max 200 chars.
- Views: `getBio`, `getTagsOfUser`, `getHoldersOfTag`, `getTagInfo`, `getAllTags`, `hasTag`, `tagCount`.
- Admin: `pause`, `unpause`, `setTagFee` (≤1 BOT), `setRefundBps` (≤10000), `withdrawFees`.

## Frontend
Single-file `frontend/index.html` (ethers UMD from cdnjs). Neumorphic / soft UI.

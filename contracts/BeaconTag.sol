// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BeaconTag
 * @notice On-chain skill/interest tag directory.
 */
contract BeaconTag is Ownable, ReentrancyGuard, Pausable {
    uint256 public tagFee = 0.001 ether;
    uint256 public refundBps = 5000; // 50%

    // tag hash => info
    struct TagInfo {
        uint256 claimedAt;
        address[] holders;
    }

    mapping(bytes32 => TagInfo) private tags;
    mapping(bytes32 => string) private tagString;
    mapping(bytes32 => bool) private tagExists;
    bytes32[] private allTagHashes;

    // user => tag hashes
    mapping(address => bytes32[]) private userTags;
    // (user, tag) => holds
    mapping(address => mapping(bytes32 => bool)) private userHasTag;
    // (user, tag) => index in tags[tag].holders
    mapping(address => mapping(bytes32 => uint256)) private holderIndex;
    // (user, tag) => index in userTags[user]
    mapping(address => mapping(bytes32 => uint256)) private userTagIndex;

    mapping(address => string) private bios;

    event TagClaimed(address indexed user, string tag, bytes32 indexed tagHash, uint256 fee);
    event TagReleased(address indexed user, string tag, bytes32 indexed tagHash, uint256 refund);
    event BioUpdated(address indexed user, string bio);

    constructor() Ownable(msg.sender) {}

    // --- Validation ---

    function _validateTag(string memory tag) internal pure returns (bytes32) {
        bytes memory b = bytes(tag);
        require(b.length >= 3 && b.length <= 32, "bad length");
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            bool isLower = (c >= 0x61 && c <= 0x7a);
            bool isDigit = (c >= 0x30 && c <= 0x39);
            bool isHyphen = (c == 0x2d);
            require(isLower || isDigit || isHyphen, "bad char");
        }
        return keccak256(b);
    }

    // --- Core ---

    function claimTag(string calldata tag, string calldata bioIfNew)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        require(msg.value >= tagFee, "fee");
        bytes32 h = _validateTag(tag);
        require(!userHasTag[msg.sender][h], "already");

        if (!tagExists[h]) {
            tagExists[h] = true;
            tagString[h] = tag;
            tags[h].claimedAt = block.timestamp;
            allTagHashes.push(h);
        }

        userHasTag[msg.sender][h] = true;
        holderIndex[msg.sender][h] = tags[h].holders.length;
        tags[h].holders.push(msg.sender);

        userTagIndex[msg.sender][h] = userTags[msg.sender].length;
        userTags[msg.sender].push(h);

        if (bytes(bios[msg.sender]).length == 0 && bytes(bioIfNew).length > 0) {
            require(bytes(bioIfNew).length <= 200, "bio too long");
            bios[msg.sender] = bioIfNew;
            emit BioUpdated(msg.sender, bioIfNew);
        }

        emit TagClaimed(msg.sender, tag, h, msg.value);
    }

    function releaseTag(string calldata tag) external nonReentrant {
        bytes32 h = _validateTag(tag);
        require(userHasTag[msg.sender][h], "not held");

        // remove from tags[h].holders via swap-and-pop
        address[] storage holders = tags[h].holders;
        uint256 idx = holderIndex[msg.sender][h];
        uint256 lastIdx = holders.length - 1;
        if (idx != lastIdx) {
            address last = holders[lastIdx];
            holders[idx] = last;
            holderIndex[last][h] = idx;
        }
        holders.pop();
        delete holderIndex[msg.sender][h];

        // remove from userTags[user]
        bytes32[] storage ut = userTags[msg.sender];
        uint256 uIdx = userTagIndex[msg.sender][h];
        uint256 uLast = ut.length - 1;
        if (uIdx != uLast) {
            bytes32 lastHash = ut[uLast];
            ut[uIdx] = lastHash;
            userTagIndex[msg.sender][lastHash] = uIdx;
        }
        ut.pop();
        delete userTagIndex[msg.sender][h];

        userHasTag[msg.sender][h] = false;

        uint256 refund = (tagFee * refundBps) / 10000;
        if (refund > 0 && address(this).balance >= refund) {
            (bool ok, ) = msg.sender.call{value: refund}("");
            require(ok, "refund fail");
        }

        emit TagReleased(msg.sender, tag, h, refund);
    }

    function updateBio(string calldata newBio) external whenNotPaused {
        require(bytes(newBio).length <= 200, "bio too long");
        bios[msg.sender] = newBio;
        emit BioUpdated(msg.sender, newBio);
    }

    // --- Views ---

    function getBio(address user) external view returns (string memory) {
        return bios[user];
    }

    function getTagsOfUser(address user) external view returns (string[] memory) {
        bytes32[] memory hs = userTags[user];
        string[] memory out = new string[](hs.length);
        for (uint256 i = 0; i < hs.length; i++) out[i] = tagString[hs[i]];
        return out;
    }

    function getHoldersOfTag(string calldata tag) external view returns (address[] memory) {
        bytes32 h = keccak256(bytes(tag));
        return tags[h].holders;
    }

    function getTagInfo(string calldata tag) external view returns (uint256 holderCount, uint256 claimedAt) {
        bytes32 h = keccak256(bytes(tag));
        return (tags[h].holders.length, tags[h].claimedAt);
    }

    function getAllTags() external view returns (string[] memory) {
        string[] memory out = new string[](allTagHashes.length);
        for (uint256 i = 0; i < allTagHashes.length; i++) out[i] = tagString[allTagHashes[i]];
        return out;
    }

    function hasTag(address user, string calldata tag) external view returns (bool) {
        return userHasTag[user][keccak256(bytes(tag))];
    }

    function tagCount() external view returns (uint256) {
        return allTagHashes.length;
    }

    // --- Admin ---

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function setTagFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1 ether, "fee too high");
        tagFee = newFee;
    }

    function setRefundBps(uint256 newBps) external onlyOwner {
        require(newBps <= 10000, "bps too high");
        refundBps = newBps;
    }

    function withdrawFees(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "zero");
        require(amount <= address(this).balance, "insufficient");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "send fail");
    }

    receive() external payable {}
}

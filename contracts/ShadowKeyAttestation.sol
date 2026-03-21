// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ShadowKeyAttestation
 * @notice Autonomous AI agent trust attestations on Status Network.
 *
 * The ShadowKey reputation engine computes trust scores for AI agents
 * based on their disclosure history (approved requests, budget violations,
 * denied requests). Agents scoring >= 70 are "Trusted". This contract
 * anchors those decisions on-chain via gasless transactions (gasPrice=0)
 * on Status Network Sepolia.
 *
 * The AI agent component: the reputation engine reads off-chain trust state
 * and autonomously decides which agents to attest — no human approves
 * individual attestations.
 *
 * Deployed on Status Network Sepolia (Chain ID: 1660990954).
 * Gasless: Status Network sets baseFeePerGas=0 at the protocol level.
 */
contract ShadowKeyAttestation {
    struct Attestation {
        address agentAddress;
        uint8   trustScore;   // 0–100, mirrors ShadowKey getTrustLevel()
        uint64  timestamp;
        bool    trusted;      // score >= 70
    }

    address public immutable owner;
    mapping(address => Attestation) public attestations;
    uint256 public attestationCount;

    event AgentAttested(
        address indexed agentAddress,
        uint8   trustScore,
        bool    trusted,
        uint64  timestamp
    );

    event AgentRevoked(
        address indexed agentAddress,
        uint64  timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Called autonomously by the ShadowKey reputation agent.
     * @param agentAddress The AI agent's Ethereum address.
     * @param trustScore   Computed trust score (0–100).
     */
    function attest(address agentAddress, uint8 trustScore) external onlyOwner {
        require(agentAddress != address(0), "Zero address");
        bool trusted = trustScore >= 70;
        attestations[agentAddress] = Attestation({
            agentAddress: agentAddress,
            trustScore:   trustScore,
            timestamp:    uint64(block.timestamp),
            trusted:      trusted
        });
        attestationCount++;
        emit AgentAttested(agentAddress, trustScore, trusted, uint64(block.timestamp));
    }

    /**
     * @notice Revoke a previously attested agent (e.g., score dropped below threshold).
     */
    function revoke(address agentAddress) external onlyOwner {
        require(attestations[agentAddress].timestamp != 0, "Not attested");
        delete attestations[agentAddress];
        emit AgentRevoked(agentAddress, uint64(block.timestamp));
    }

    function getAttestation(address agent) external view returns (Attestation memory) {
        return attestations[agent];
    }

    function isTrusted(address agent) external view returns (bool) {
        return attestations[agent].trusted;
    }
}

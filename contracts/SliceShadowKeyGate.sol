// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SliceShadowKeyGate
 * @notice Slice product hook that gates purchases by ShadowKey agent trust status.
 *
 * Implements the Slice IProductAction interface:
 *   - isPurchaseAllowed() — checks if the buyer is a ShadowKey-trusted agent
 *   - onProductPurchase() — records the purchase and emits a PrivacyPreservedPurchase event
 *
 * Integration flow:
 *   1. ShadowKey reputation engine attests agent trust scores on Status Network Sepolia.
 *   2. The ShadowKey operator mirrors TRUSTED decisions here via setAgentTrust().
 *   3. When a Slice product has this hook attached, untrusted agents are blocked at checkout.
 *   4. Trusted agents receive a signed consent receipt on purchase (emitted as event).
 *
 * Deployed on Base Sepolia (chainId: 84532).
 */
contract SliceShadowKeyGate {
    // ─────────────────────────────────────────────────────────── state ──

    address public immutable owner;

    /// @notice Minimum trust score required to purchase (mirrors ShadowKey threshold: 70).
    uint8 public constant TRUST_THRESHOLD = 70;

    struct AgentRecord {
        uint8   trustScore;    // 0–100, from ShadowKey reputation engine
        uint64  attestedAt;    // Unix timestamp of last sync
        bool    trusted;       // trustScore >= TRUST_THRESHOLD
    }

    /// @notice Maps agent address → trust record (synced from ShadowKey on Status Network).
    mapping(address => AgentRecord) public agentRecords;

    /// @notice Optional per-product overrides: productId → allowed (true) / blocked (false).
    /// @dev    Use this to exempt specific products from the trust gate.
    mapping(uint256 => bool) public productExempt;

    /// @notice Total purchases gated by this hook.
    uint256 public purchaseCount;

    // ─────────────────────────────────────────────────────────── events ──

    event AgentTrustUpdated(
        address indexed agent,
        uint8   trustScore,
        bool    trusted,
        uint64  attestedAt
    );

    /// @notice Emitted on every successful purchase — acts as an on-chain consent receipt.
    event PrivacyPreservedPurchase(
        address indexed buyer,
        uint256 indexed productId,
        uint32  quantity,
        uint8   trustScore,
        uint64  timestamp
    );

    event PurchaseBlocked(
        address indexed buyer,
        uint256 indexed productId,
        string  reason
    );

    event ProductExemptUpdated(uint256 indexed productId, bool exempt);

    // ─────────────────────────────────────────────────────────── modifiers ──

    modifier onlyOwner() {
        require(msg.sender == owner, "SliceShadowKeyGate: not owner");
        _;
    }

    // ─────────────────────────────────────────────────────────── constructor ──

    constructor() {
        owner = msg.sender;
    }

    // ─────────────────────────────────────────────────────────── admin ──

    /**
     * @notice Sync an agent's trust status from the ShadowKey reputation engine.
     * @dev    Called by the ShadowKey operator after attesting on Status Network Sepolia.
     *         V1: manual sync. V2: cross-chain message via bridge/LayerZero.
     * @param agent      The AI agent's Ethereum address.
     * @param trustScore Trust score (0–100). Score >= 70 marks the agent as trusted.
     */
    function setAgentTrust(address agent, uint8 trustScore) external onlyOwner {
        require(agent != address(0), "SliceShadowKeyGate: zero address");
        bool trusted = trustScore >= TRUST_THRESHOLD;
        agentRecords[agent] = AgentRecord({
            trustScore: trustScore,
            attestedAt: uint64(block.timestamp),
            trusted:    trusted
        });
        emit AgentTrustUpdated(agent, trustScore, trusted, uint64(block.timestamp));
    }

    /**
     * @notice Bulk-sync multiple agents in one transaction (gas-efficient for batch updates).
     */
    function setAgentTrustBatch(
        address[] calldata agents,
        uint8[]   calldata scores
    ) external onlyOwner {
        require(agents.length == scores.length, "SliceShadowKeyGate: length mismatch");
        for (uint256 i = 0; i < agents.length; i++) {
            require(agents[i] != address(0), "SliceShadowKeyGate: zero address");
            bool trusted = scores[i] >= TRUST_THRESHOLD;
            agentRecords[agents[i]] = AgentRecord({
                trustScore: scores[i],
                attestedAt: uint64(block.timestamp),
                trusted:    trusted
            });
            emit AgentTrustUpdated(agents[i], scores[i], trusted, uint64(block.timestamp));
        }
    }

    /**
     * @notice Exempt a product from the trust gate (e.g., free/public products).
     */
    function setProductExempt(uint256 productId, bool exempt) external onlyOwner {
        productExempt[productId] = exempt;
        emit ProductExemptUpdated(productId, exempt);
    }

    // ─────────────────────────────────────────────────────────── IProductAction ──

    /**
     * @notice Slice calls this before allowing a purchase. Returns false to block.
     * @dev    Implements IProductAction.isPurchaseAllowed().
     * @param productId Slice product ID.
     * @param buyer     Address attempting to purchase.
     */
    function isPurchaseAllowed(
        uint256 productId,
        uint32  /* quantity */,
        address buyer,
        bytes   calldata /* data */
    ) external view returns (bool) {
        // Exempt products always pass
        if (productExempt[productId]) return true;
        // Buyer must be a ShadowKey-trusted agent
        return agentRecords[buyer].trusted;
    }

    /**
     * @notice Slice calls this after a successful purchase.
     * @dev    Implements IProductAction.onProductPurchase().
     *         Emits a PrivacyPreservedPurchase event as an on-chain consent receipt.
     */
    function onProductPurchase(
        uint256 productId,
        uint32  quantity,
        address buyer,
        bytes   calldata /* data */
    ) external returns (bytes memory) {
        purchaseCount++;

        uint8 score = agentRecords[buyer].trustScore;

        emit PrivacyPreservedPurchase(
            buyer,
            productId,
            quantity,
            score,
            uint64(block.timestamp)
        );

        // Return ABI-encoded consent receipt (purchaseCount, trustScore, timestamp)
        return abi.encode(purchaseCount, score, uint64(block.timestamp));
    }

    // ─────────────────────────────────────────────────────────── view helpers ──

    function isTrusted(address agent) external view returns (bool) {
        return agentRecords[agent].trusted;
    }

    function getTrustScore(address agent) external view returns (uint8) {
        return agentRecords[agent].trustScore;
    }
}

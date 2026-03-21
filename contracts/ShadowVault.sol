// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ShadowVault
 * @notice Human-controlled privacy vault for AI agents on Base.
 *         Manages disclosure policies, audit logs, privacy budgets,
 *         and emergency lockdown — all verifiable on-chain.
 */
contract ShadowVault {
    // ─── Enums ───────────────────────────────────────────────
    enum Category { Payment, Identity, Credentials, Health, Preferences }

    // ─── Structs ─────────────────────────────────────────────
    struct OnChainPolicy {
        bytes32 policyId;
        address agentAddress;
        Category category;
        uint96  spendLimit;   // per-txn cap in cents
        uint96  totalLimit;   // cumulative cap in cents
        uint96  totalSpent;   // cumulative spent in cents
        uint64  expiresAt;    // unix timestamp
        bytes32 detailsHash;  // keccak256(allowedServices, revealFields, hiddenFields)
        bool    active;
    }

    struct OnChainBudget {
        Category category;
        uint16  maxDisclosuresPerDay;
        uint16  maxDisclosuresPerWeek;
        uint16  maxUniqueServices;
        uint96  maxSpendPerDay;
        uint8   alertThresholdPct;
    }

    // ─── State ───────────────────────────────────────────────
    address public immutable owner;
    bool    public lockedDown;

    mapping(bytes32 => OnChainPolicy) public policies;
    bytes32[] public policyIds;

    mapping(Category => OnChainBudget) public budgets;
    mapping(Category => uint256)       public disclosureCount;

    uint256 public policyCount;

    // ─── Events ──────────────────────────────────────────────
    event PolicyRegistered(
        bytes32 indexed policyId,
        address indexed agentAddress,
        Category category,
        uint96  spendLimit,
        uint96  totalLimit,
        uint64  expiresAt,
        bytes32 detailsHash
    );

    event PolicyRevoked(
        bytes32 indexed policyId,
        address indexed agentAddress,
        uint256 timestamp
    );

    event DisclosureLogged(
        bytes32 indexed policyId,
        address indexed agentAddress,
        address indexed serviceAddress,
        Category category,
        uint96   amount,
        bytes32  detailsHash,
        uint256  timestamp
    );

    event BudgetUpdated(
        Category indexed category,
        uint16 maxDisclosuresPerDay,
        uint16 maxDisclosuresPerWeek,
        uint96 maxSpendPerDay
    );

    event EmergencyLockdown(
        uint256 policiesRevoked,
        uint256 timestamp,
        string  reason
    );

    event LockdownLifted(uint256 timestamp);

    // ─── Modifiers ───────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Not vault owner");
        _;
    }

    modifier notLockedDown() {
        require(!lockedDown, "Vault is in lockdown");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────
    constructor() {
        owner = msg.sender;
    }

    // ─── Policy Management ───────────────────────────────────

    function registerPolicy(
        bytes32 policyId,
        address agentAddress,
        Category category,
        uint96  spendLimit,
        uint96  totalLimit,
        uint64  expiresAt,
        bytes32 detailsHash
    ) external onlyOwner notLockedDown {
        require(policies[policyId].expiresAt == 0, "Policy already exists");
        require(agentAddress != address(0), "Invalid agent address");
        require(expiresAt > block.timestamp, "Expiry must be in future");

        policies[policyId] = OnChainPolicy({
            policyId:     policyId,
            agentAddress: agentAddress,
            category:     category,
            spendLimit:   spendLimit,
            totalLimit:   totalLimit,
            totalSpent:   0,
            expiresAt:    expiresAt,
            detailsHash:  detailsHash,
            active:       true
        });
        policyIds.push(policyId);
        policyCount++;

        emit PolicyRegistered(
            policyId, agentAddress, category,
            spendLimit, totalLimit, expiresAt, detailsHash
        );
    }

    function revokePolicy(bytes32 policyId) external onlyOwner {
        OnChainPolicy storage p = policies[policyId];
        require(p.active, "Policy not active");

        p.active = false;
        emit PolicyRevoked(policyId, p.agentAddress, block.timestamp);
    }

    // ─── Disclosure Logging ──────────────────────────────────

    function logDisclosure(
        bytes32 policyId,
        address serviceAddress,
        uint96  amount,
        bytes32 detailsHash
    ) external onlyOwner notLockedDown {
        OnChainPolicy storage p = policies[policyId];
        require(p.active, "Policy not active");
        require(block.timestamp <= p.expiresAt, "Policy expired");

        if (p.spendLimit > 0) {
            require(amount <= p.spendLimit, "Exceeds per-txn limit");
        }
        if (p.totalLimit > 0) {
            require(p.totalSpent + amount <= p.totalLimit, "Exceeds total limit");
        }

        p.totalSpent += amount;
        disclosureCount[p.category]++;

        emit DisclosureLogged(
            policyId, p.agentAddress, serviceAddress,
            p.category, amount, detailsHash, block.timestamp
        );
    }

    // ─── Privacy Budget ──────────────────────────────────────

    function updateBudget(
        Category category,
        uint16   maxDisclosuresPerDay,
        uint16   maxDisclosuresPerWeek,
        uint16   maxUniqueServices,
        uint96   maxSpendPerDay,
        uint8    alertThresholdPct
    ) external onlyOwner {
        budgets[category] = OnChainBudget({
            category:              category,
            maxDisclosuresPerDay:  maxDisclosuresPerDay,
            maxDisclosuresPerWeek: maxDisclosuresPerWeek,
            maxUniqueServices:     maxUniqueServices,
            maxSpendPerDay:        maxSpendPerDay,
            alertThresholdPct:     alertThresholdPct
        });

        emit BudgetUpdated(
            category, maxDisclosuresPerDay,
            maxDisclosuresPerWeek, maxSpendPerDay
        );
    }

    // ─── Emergency Lockdown ──────────────────────────────────

    function emergencyLockdown(string calldata reason) external onlyOwner {
        require(!lockedDown, "Already locked down");

        uint256 revoked;
        for (uint256 i; i < policyIds.length; i++) {
            OnChainPolicy storage p = policies[policyIds[i]];
            if (p.active) {
                p.active = false;
                revoked++;
                emit PolicyRevoked(policyIds[i], p.agentAddress, block.timestamp);
            }
        }

        lockedDown = true;
        emit EmergencyLockdown(revoked, block.timestamp, reason);
    }

    function liftLockdown() external onlyOwner {
        require(lockedDown, "Not locked down");
        lockedDown = false;
        emit LockdownLifted(block.timestamp);
    }

    // ─── View Functions ──────────────────────────────────────

    function getPolicy(bytes32 policyId) external view returns (OnChainPolicy memory) {
        return policies[policyId];
    }

    function getBudget(Category category) external view returns (OnChainBudget memory) {
        return budgets[category];
    }

    function isLockedDown() external view returns (bool) {
        return lockedDown;
    }

    function getPolicyCount() external view returns (uint256) {
        return policyCount;
    }
}

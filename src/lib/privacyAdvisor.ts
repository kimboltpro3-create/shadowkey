import type {
  Policy, DisclosureLog, PrivacyBudget, EphemeralPersona,
  DeadManSwitch, PrivacyRecommendation, SecretCategory,
} from '../types';

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function getUniqueServicesForCategory(logs: DisclosureLog[], category: SecretCategory): number {
  const services = new Set(logs.filter((l) => l.category === category).map((l) => l.service_address));
  return services.size;
}

export function generateRecommendations(
  policies: Policy[],
  logs: DisclosureLog[],
  budgets: PrivacyBudget[],
  personas: EphemeralPersona[],
  deadManSwitch: DeadManSwitch | null
): PrivacyRecommendation[] {
  const recs: PrivacyRecommendation[] = [];
  const now = new Date();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  const activePolicies = policies.filter((p) => p.active && new Date(p.expires_at) > now);

  for (const policy of activePolicies) {
    const agentLogs = logs.filter(
      (l) => l.agent_address === policy.agent_address && l.category === policy.category
    );

    const recentLogs = agentLogs.filter((l) => new Date(l.timestamp) > sevenDaysAgo);
    if (agentLogs.length > 0 && recentLogs.length === 0 && new Date(policy.created_at) < fourteenDaysAgo) {
      recs.push({
        id: makeId(),
        type: 'revoke_unused',
        severity: 'medium',
        title: 'Stale policy detected',
        description: `Agent ${policy.agent_alias || policy.agent_address.slice(0, 10)}... has a ${policy.category} policy with no activity in 14+ days. Consider revoking it.`,
        agent_address: policy.agent_address,
        category: policy.category,
        actionLabel: 'Review Policies',
        actionRoute: '/policies',
      });
    }

    if (agentLogs.length === 0 && policy.reveal_fields.length > 3) {
      recs.push({
        id: makeId(),
        type: 'restrict_fields',
        severity: 'low',
        title: 'Broad field access with no usage',
        description: `Agent ${policy.agent_alias || policy.agent_address.slice(0, 10)}... can access ${policy.reveal_fields.length} fields in ${policy.category} but has never used them.`,
        agent_address: policy.agent_address,
        category: policy.category,
        actionLabel: 'Edit Policy',
        actionRoute: '/policies',
      });
    }

    const hasIdentityAccess = policies.some(
      (p) => p.agent_address === policy.agent_address && p.category === 'identity' && p.active
    );
    const hasPaymentAccess = policies.some(
      (p) => p.agent_address === policy.agent_address && p.category === 'payment' && p.active
    );
    if (hasIdentityAccess && hasPaymentAccess) {
      const hasPersona = personas.some(
        (p) => p.active && new Date(p.expires_at) > now &&
        policies.some((pol) => pol.id === p.policy_id && pol.agent_address === policy.agent_address)
      );
      if (!hasPersona && !recs.some((r) => r.type === 'enable_persona' && r.agent_address === policy.agent_address)) {
        recs.push({
          id: makeId(),
          type: 'enable_persona',
          severity: 'high',
          title: 'Correlation risk detected',
          description: `Agent ${policy.agent_alias || policy.agent_address.slice(0, 10)}... accesses both identity and payment data. Use a persona to break the correlation.`,
          agent_address: policy.agent_address,
          actionLabel: 'Create Persona',
          actionRoute: '/personas',
        });
      }
    }
  }

  const categories: SecretCategory[] = ['payment', 'identity', 'credentials', 'health', 'preferences'];
  const budgetMap = new Map(budgets.map((b) => [b.category, b]));

  for (const cat of categories) {
    const catPolicies = activePolicies.filter((p) => p.category === cat);
    if (catPolicies.length === 0) continue;

    const budget = budgetMap.get(cat);
    if (!budget) {
      recs.push({
        id: makeId(),
        type: 'add_budget',
        severity: 'high',
        title: `No privacy budget for ${cat}`,
        description: `You have ${catPolicies.length} active ${cat} policies but no disclosure budget configured. Set limits to control exposure.`,
        category: cat,
        actionLabel: 'Set Budget',
        actionRoute: '/budget',
      });
      continue;
    }

    const uniqueServices = getUniqueServicesForCategory(logs, cat);
    if (budget.max_unique_services > 0 && uniqueServices > budget.max_unique_services) {
      recs.push({
        id: makeId(),
        type: 'over_exposed',
        severity: 'high',
        title: `Over-exposed ${cat} data`,
        description: `${cat} data shared with ${uniqueServices} unique services, exceeding your limit of ${budget.max_unique_services}.`,
        category: cat,
        actionLabel: 'Review Budget',
        actionRoute: '/budget',
      });
    }

    const catLogs = logs.filter((l) => l.category === cat);
    const weekLogs = catLogs.filter((l) => new Date(l.timestamp) > sevenDaysAgo);
    const avgDailyUsage = weekLogs.length / 7;
    if (budget.max_disclosures_per_day > 0 && avgDailyUsage < budget.max_disclosures_per_day * 0.3 && weekLogs.length > 0) {
      recs.push({
        id: makeId(),
        type: 'adjust_budget',
        severity: 'low',
        title: `Excess budget headroom for ${cat}`,
        description: `Average daily usage is ${avgDailyUsage.toFixed(1)} but limit is ${budget.max_disclosures_per_day}. Consider tightening to reduce blast radius.`,
        category: cat,
        actionLabel: 'Adjust Budget',
        actionRoute: '/budget',
      });
    }
  }

  if (!deadManSwitch || !deadManSwitch.active) {
    recs.push({
      id: makeId(),
      type: 'enable_deadman',
      severity: 'medium',
      title: 'No dead man switch active',
      description: 'If you become unavailable, active policies and personas will remain accessible indefinitely. Enable a dead man switch for automatic lockdown.',
      actionLabel: 'Enable Switch',
      actionRoute: '/deadman',
    });
  }

  recs.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  return recs;
}

export function computePrivacyGrade(recommendations: PrivacyRecommendation[]): { grade: string; color: string } {
  const highCount = recommendations.filter((r) => r.severity === 'high').length;
  const medCount = recommendations.filter((r) => r.severity === 'medium').length;

  if (highCount === 0 && medCount === 0) return { grade: 'A', color: 'text-emerald-400' };
  if (highCount === 0 && medCount <= 2) return { grade: 'B', color: 'text-cyan-400' };
  if (highCount <= 1) return { grade: 'C', color: 'text-amber-400' };
  if (highCount <= 3) return { grade: 'D', color: 'text-orange-400' };
  return { grade: 'F', color: 'text-rose-400' };
}

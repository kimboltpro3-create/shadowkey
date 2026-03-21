import { CreditCard, User, Key, Heart, Star } from 'lucide-react';
import type { SecretCategory } from '../../types';
import { CATEGORY_COLORS } from '../../lib/constants';

const ICONS = { payment: CreditCard, identity: User, credentials: Key, health: Heart, preferences: Star };

export function CategoryIcon({ category, size = 16 }: { category: SecretCategory; size?: number }) {
  const Icon = ICONS[category];
  const colors = CATEGORY_COLORS[category];
  return (
    <div className={`w-8 h-8 rounded-lg ${colors.bg} border ${colors.border} flex items-center justify-center flex-shrink-0`}>
      <Icon size={size} className={colors.icon} />
    </div>
  );
}

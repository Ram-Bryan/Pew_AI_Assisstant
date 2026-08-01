import { Pressable, ScrollView, Text } from 'react-native';
import type { AppFilters } from '../filterApps';

const KIND_OPTIONS: Array<{ value: AppFilters['kind']; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'ai', label: 'AI' },
  { value: 'app', label: 'Apps' },
];

const ENABLED_OPTIONS: Array<{ value: AppFilters['enabled']; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' },
];

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`mr-2 rounded-full px-3 py-1.5 ${active ? 'bg-primary' : 'bg-gray-200'}`}
    >
      <Text className={`text-sm font-medium ${active ? 'text-white' : 'text-gray-700'}`}>{label}</Text>
    </Pressable>
  );
}

export function FilterBar({
  value,
  onChange,
}: {
  value: AppFilters;
  onChange: (filters: AppFilters) => void;
}) {
  return (
    <ScrollView horizontal className="px-4 py-2" showsHorizontalScrollIndicator={false}>
      {KIND_OPTIONS.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          active={value.kind === o.value}
          onPress={() => onChange({ ...value, kind: o.value })}
        />
      ))}
      {ENABLED_OPTIONS.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          active={value.enabled === o.value}
          onPress={() => onChange({ ...value, enabled: o.value })}
        />
      ))}
    </ScrollView>
  );
}

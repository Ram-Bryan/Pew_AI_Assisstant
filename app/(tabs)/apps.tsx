import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { AppList } from '../../src/domains/apps/components/AppList';
import { FilterBar } from '../../src/domains/apps/components/FilterBar';
import { filterApps } from '../../src/domains/apps/filterApps';
import type { AppFilters } from '../../src/domains/apps/filterApps';
import { useAppsList } from '../../src/domains/apps/hooks';

const DEFAULT_FILTERS: AppFilters = { enabled: 'all', kind: 'all' };

export default function AppsScreen() {
  const { data, isLoading } = useAppsList();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<AppFilters>(DEFAULT_FILTERS);
  const visible = filterApps(data ?? [], query, filters);
  return (
    <View className="flex-1 bg-gray-50">
      <TextInput
        className="mx-4 mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
        placeholder="Search apps…"
        placeholderTextColor="#9CA3AF"
        value={query}
        onChangeText={setQuery}
      />
      <FilterBar value={filters} onChange={setFilters} />
      <AppList items={visible} isLoading={isLoading} />
    </View>
  );
}

import { View } from 'react-native';
import { AppList } from '../../src/domains/apps/components/AppList';
import { useAppsList } from '../../src/domains/apps/hooks';

export default function AppsScreen() {
  const { data, isLoading } = useAppsList();
  return (
    <View className="flex-1 bg-gray-50">
      <AppList items={data ?? []} isLoading={isLoading} />
    </View>
  );
}

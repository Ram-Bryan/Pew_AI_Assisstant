import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from 'react-native';
import type { AppWithStatus } from '../types';
import { APP_ICONS } from '../appIcons';

export function AppList({ items, isLoading }: { items: AppWithStatus[]; isLoading: boolean }) {
  const router = useRouter();
  if (isLoading) {
    return <ActivityIndicator className="mt-10" color="#22C55E" />;
  }
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => String(item.id)}
      contentContainerClassName="p-4"
      renderItem={({ item }) => (
        <Pressable
          className="mb-3 flex-row items-center rounded-2xl border border-gray-100 bg-white p-4"
          onPress={() => router.push(`/apps/${item.id}`)}
        >
          <View className="mr-3 h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
            {APP_ICONS[item.icon] ? (
              <Image source={APP_ICONS[item.icon]} className="h-12 w-12" resizeMode="contain" />
            ) : (
              <Text className="text-xl font-bold text-gray-700">{item.icon[0].toUpperCase()}</Text>
            )}
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
            <Text className="text-sm text-gray-500" numberOfLines={1}>
              {item.description}
            </Text>
          </View>
          <View className="mr-2 rounded-full bg-blue-50 px-2 py-1">
            <Text className="text-xs font-medium text-accent">{item.is_ai ? 'AI' : 'App'}</Text>
          </View>
          <View className={`rounded-full px-2 py-1 ${item.is_enabled ? 'bg-green-100' : 'bg-gray-100'}`}>
            <Text className={`text-xs font-medium ${item.is_enabled ? 'text-primary' : 'text-gray-500'}`}>
              {item.is_enabled ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
        </Pressable>
      )}
    />
  );
}

import { Switch, Text, View } from 'react-native';
import { useToggleApp } from '../hooks';
import type { AppWithStatus } from '../types';

export function AppToggle({ app }: { app: AppWithStatus }) {
  const toggle = useToggleApp();
  return (
    <View className="mt-6 flex-row items-center justify-between">
      <Text className="text-base font-medium text-gray-900">Enabled</Text>
      <Switch
        value={app.is_enabled}
        onValueChange={(value) => toggle.mutate({ appId: app.id, enabled: value })}
        trackColor={{ true: '#22C55E' }}
      />
    </View>
  );
}

import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'People' }} />
      <Tabs.Screen name="stuff" options={{ title: 'Heyy' }} />
    </Tabs>
  );
}
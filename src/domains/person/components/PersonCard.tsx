import { View, Text } from 'react-native';
import { Person } from '../types';

interface PersonCardProps {
  person: Person;
}

export function PersonCard({ person }: PersonCardProps) {
  return (
    <View className="bg-white p-4 rounded-xl mb-3 border border-gray-200 shadow-sm">
      <Text className="text-lg font-bold text-gray-900">Name: {person.name}</Text>
      <Text className="text-sm text-gray-600 mt-1">Age: {person.age}</Text>
      <Text className="text-sm text-blue-600 mt-1">Mail: {person.email}</Text>
      <Text></Text>
    </View>
  );
}

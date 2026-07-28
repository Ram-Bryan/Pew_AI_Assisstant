import { View, Text, FlatList } from 'react-native';
import { people } from '../../src/domains/person/data';
import { PersonCard } from '../../src/domains/person/components/PersonCard';

export default function IndexScreen() {
  return (
    <View className="flex-1 bg-gray-100 p-4" >

      <Text className="text-2xl font-bold text-gray-900 mb-4">People</Text>
      {people.map((person) => (
        <PersonCard key={person.id} person={person} />
      ))}
    </View>

  );
}
### Display
To display something inside app, we use 
```tsx

export default function namefunction(){
    <View>
        // we put everything here
    </View>
}

```

### Displays
```tsx

<Text> This is a simple text </Text>

<Pressable onPress={() => console.log('clicked')}>
  <Text>This is a button</Text>
</Pressable>

// For images
<Image 
  source={require('../assets/icon.png')} 
  className="w-24 h-24 rounded-full"
/>


```

## useState
To change the state of something
``` ts

const [count, setCount] = useState(10);      // Starts at 10
const [name, setName] = useState("");        // Starts as empty string
const [items, setItems] = useState([]);       // Starts as empty array
const [user, setUser] = useState(null);       // Starts as null


// What useState actually returns behind the scenes:
const result = useState(0);
// result = [0, function]  ← an array with 2 elements

const count = result[0];      // The number 0
const setCount = result[1];   // The setter function

```

## Loops:
```tsx
We use map:

      {people.map((person) => (
        <PersonCard key={person.id} person={person} />
      ))}


```

## useEffect:
Code that runs when something appears, disappears, or changes

``` tsx

useEffect(() => {
  console.log('Runs when userId changes');
}, [userId]);

// Render 1: userId = 1. Previous = nothing. Run.
// Render 2: userId = 1. Previous = [1]. Same. Skip.
// Render 3: userId = 2. Previous = [1]. Different! Run.

// inside the [], are the value we're watching
// if [], then basically run once
// [a, b] When a OR b changes
```


``` tsx

import { useEffect } from 'react';

export function HomeScreen() {
  useEffect(() => {
    console.log('Screen opened!');
  return <Text>Hello</Text>;
}



```

## Inputs

``` tsx


import { TextInput, View, Text } from 'react-native';
import { useState } from 'react';

const [email, setEmail] = useState('');

<TextInput
  value={email}
  onChangeText={setEmail}
  placeholder="Enter email"
  keyboardType="email-address"
  autoCapitalize="none"
  className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white"
/>


```

### Making tables

``` tsx


// Table header
<View className="flex flex-row bg-gray-100 p-3 border-b border-gray-300">
  <Text className="flex-1 font-bold">Name</Text>
  <Text className="flex-1 font-bold">Age</Text>
  <Text className="flex-1 font-bold">Email</Text>
</View>

// Table row
<View className="flex flex-row p-3 border-b border-gray-200">
  <Text className="flex-1">Alice</Text>
  <Text className="flex-1">28</Text>
  <Text className="flex-1">alice@example.com</Text>
</View>


```


### Components:


``` tsx


import { View, Text } from 'react-native';

// Props interface (like a Java constructor parameter list)
interface GreetingProps {
  name: string;
  age?: number;  // Optional
}

export function Greeting({ name, age = 0 }: GreetingProps) {
  return (
    <View>
      <Text>Hello, {name}!</Text>
      {age > 0 && <Text>You are {age} years old.</Text>}
    </View>
  );
}

// Usage:
<Greeting name="Alice" age={28} />
<Greeting name="Bob" />  // age defaults to 0



```


``` tsx

// Logical
return (
  <View>
    {hasError && <Text className="text-red-500">Error occurred!</Text>}
    {items.length > 0 && <ItemList items={items} />}
  </View>
);


```


### Pass callback

```tsx

// The prop
interface TdlCardProps {
    task: Task;
    todos: Task[];
    onDelete: (taskId: number) => void;  // Add callback prop
}

// The component
<Pressable 
                onPress={() => onDelete(task.id)}  // Call the parent's handler
                className="bg-red-500 px-6 py-3 rounded-lg"
            >
                <Text>Delete</Text>
            </Pressable>


// The View
const handleDeleteTask = (taskId: number) => {
        const updatedTodos = deleteTask(tdl, taskId);  // Get filtered array
        setTdl(updatedTodos);  // Update state - THIS TRIGGERS RE-RENDER!
};

```

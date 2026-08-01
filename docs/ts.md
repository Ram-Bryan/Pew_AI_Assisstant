### Declaring objects (constructors):
```ts
interface Person {
  id: number;
  name: string;
  age?: number;
  email?: string;  //   ? means optional
}

const user = {
  id: 1,
  name: "Alice",
  email: "alice@example.com",
};
console.log(user.name);      // "Alice"

```
We use **export** so that we can use it on other files

### Declaring variables or constants:
Ts use strict typing

```ts

const age: number = 3;
let price: number = 4.5
const prices: number[] = [1,2,3]

const bool: boolean = true;
const nul: null = null;
const undef: undefined = undefined;

// Any (like Java Object)
const anything: any = "could be anything";


```

### Working with arrays

```ts


const alice: Person =   { id: 1, name: 'Alice', age: 28, email: 'alice@example.com' };

// adding
let people: Person[] = [];
people.push(people);

// deleting by creating a new array from it
const tasks = [
    { id: 1, content: "Task 1" },
    { id: 2, content: "Task 2" },
    { id: 3, content: "Task 3" }
];
const updatedTasks = tasks.filter(task => task.id !== 2);



```

## Functions:
``` ts

// we put ` apostrophes and not quotes
function greet(name: string): string {
    return `Hi ${name}`;
}

// OR 

const greet = (name: string): string => `Hi ${name}`;

```

## Loops:
``` ts


// For loop (same as Java)
for (let i = 0; i < numbers.length; i++) {
  console.log(numbers[i]);
}

// For...of (like Java enhanced for-loop)
for (const num of numbers) {
  console.log(num);
}

// forEach (like Java Stream.forEach)
numbers.forEach((num, index) => {
  console.log(`${index}: ${num}`);
});

```


## Destructuring

``` ts

// Instead of:
const name = user.name;
const age = user.age;

// Do this:
const { name, age } = user;

// Use it here
function PersonCard({ person }: { person: Person }) {
  const { name, age } = person;
  return <Text>{name}, {age}</Text>;
}


// Instead of receiving 'props', we immediately extract 'person' from it
function PersonCard({ person }: { person: Person }) {
  // Now 'person' is a direct variable. No 'props.' prefix needed.
  return <Text>{person.name}</Text>;

  // You'd write props.person.name everywhere without destructuring. Because Prosp already have an attribute of person, we alreayd use it. 
//   return <Text>{props.person.name}</Text>;
}

```


## I\O

**Read a file**

``` ts

import * as FileSystem from 'expo-file-system';

const readFile = async () => {
  const path = FileSystem.documentDirectory + 'myfile.txt';
  
  try {
    const content = await FileSystem.readAsStringAsync(path);
    console.log(content);  // "Hello world"
    return content;
  } catch (error) {
    console.log('File not found');
    return null;
  }
};

```

**Read a file**

``` ts


const writeFile = async () => {
  const path = FileSystem.documentDirectory + 'myfile.txt';
  const content = 'Hello world';
  
  await FileSystem.writeAsStringAsync(path, content);
};


```

## Spreading

```ts

// Takes all the object property but only change one thing:
{...task, content: content}

// If manually copying:
const updatedTask = {
    id: task.id,
    content: "New content",
    done: task.done
};


```
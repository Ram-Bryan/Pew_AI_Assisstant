import { View, Text } from "react-native";
import { Task } from "../types";

export function TdlCard(task: Task) {
    return (
        <View>
            <Text>{task.content}</Text>
            <Text>{task.done}</Text>
        </View>
    )
}

export interface Task {
    id: number;
    content: string;
    done: boolean;
}

import { Task } from "./types";

export const todos: Task[] = [
    {id:1, content:"Exemple 1", done:false},
    {id:2, content:"Exemple 2", done:false},
    {id:3, content:"Exemple 3", done:false},
]
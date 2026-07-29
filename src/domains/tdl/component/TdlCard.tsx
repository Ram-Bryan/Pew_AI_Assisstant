import { View, Text, Pressable, TextInput } from "react-native";
import { Task } from "../types";
import { useState } from "react";
import { deleteTask } from "../types";

interface TdlCardProps {
    task: Task;
    onDelete: (taskId: number) => void;
    onEdit: (taskId: number) => void;
}

export function TdlCard({ task, onDelete }: TdlCardProps) {
    const [done, setDone] = useState(task.done);

    return (

        <View>
            <TextInput value={task.content} onChangeText={()=>{onEdit(task.id)}} className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white"></TextInput>
            {/* <Text>{task.content}</Text> */}
            <Pressable onPress={() => {setDone(!done)}} >
                <Text>{String(done)}</Text>
            </Pressable>

            <Pressable onPress={()=>{onDelete(task.id)}} className="bg-red-500 px-6 py-3 rounded-lg disabled:bg-gray-300">
                <Text>Delete</Text>
            </Pressable>

        </View>
    )
}
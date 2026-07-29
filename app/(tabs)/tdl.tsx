import { View, Text, TextInput, Pressable } from "react-native";
import { TdlCard } from "../../src/domains/tdl/component/TdlCard";
import { todos } from "../../src/domains/tdl/data";
import { useState } from "react";
import { addTask } from "../../src/domains/tdl/types";
import { deleteTask } from "../../src/domains/tdl/types";
import { editTask } from "../../src/domains/tdl/types";

export default function tdlScreen(){

    const [content, setContent] = useState("");
    const [tdl, setTodo] = useState(todos);

    const handleAddTask = (cont: string) => {
        addTask(tdl, cont);
        setTodo(tdl);
        setContent("");        
    }

    const handleDeleteTask = (taskId: number) => {
        const updatedTodos = deleteTask(tdl, taskId);
        setTodo(updatedTodos);
    };
    
    const handleEditTask = (taskId: number) => {
        const updatedTodos = editTask(tdl, taskId, content);
        setTodo(updatedTodos);
    }
  
    return (
        <View>
            {tdl.map( (task) => (
                <TdlCard key={task.id} task={task} onDelete={handleDeleteTask} onEdit={handleEditTask} ></TdlCard>
            ))}

            <Text>Add a task</Text>
                <TextInput value={content} onChangeText={setContent} placeholder="Content ?" className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white">
            </TextInput>

            <Pressable onPress={ () => {handleAddTask(content)}} className="bg-blue-600 rounded-lg w-60 p-4 active:bg-blue-700">
                <Text>Add</Text>
            </Pressable>

        </View>
    )
}
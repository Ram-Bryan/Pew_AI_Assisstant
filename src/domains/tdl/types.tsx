export interface Task {
    id: number;
    content: string;
    done: boolean;
}

export function addTask(todos: Task[], content: string){
        const lastId: number = todos[todos.length - 1].id;
        const newTask: Task = {id: lastId + 1, content: content, done: false };
        todos.push(newTask);
}

export function deleteTask(todos: Task[], id:number){
    return todos.filter(task => task.id !== id)
}

export function editTask(todos: Task[], id: number, content: string){
    todos[id].content = content
    return todos;
}
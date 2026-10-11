export interface Task {
  id: string;
  title: string;
  completed: boolean;
}

let tasks: Task[] = [];
let nextId = 1;

export function resetStore(): void {
  tasks = [];
  nextId = 1;
}

export function listTasks(filter?: { completed?: boolean }): Task[] {
  if (filter && typeof filter.completed === "boolean") {
    return tasks.filter((t) => t.completed === filter.completed);
  }
  return [...tasks];
}

export function createTask(input: { title: string; completed?: boolean }): Task {
  const task: Task = {
    id: String(nextId++),
    title: input.title,
    completed: input.completed ?? false,
  };
  tasks.push(task);
  return task;
}

export function updateTask(id: string, patch: Partial<Pick<Task, "title" | "completed">>): Task | undefined {
  const task = tasks.find((t) => t.id === id);
  if (!task) return undefined;
  if (patch.title !== undefined) task.title = patch.title;
  if (patch.completed !== undefined) task.completed = patch.completed;
  return task;
}

export function deleteTask(id: string): boolean {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return false;
  tasks.splice(index, 1);
  return true;
}

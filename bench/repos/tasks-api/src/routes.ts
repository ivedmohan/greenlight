import { Router, Request, Response } from "express";
import { listTasks, createTask, updateTask, deleteTask } from "./store.js";
import { validateTask } from "./validate.js";

export const router = Router();

router.get("/", (req: Request, res: Response) => {
  const { completed } = req.query;
  if (completed === undefined) {
    return res.json(listTasks());
  }
  const completedBool = completed === "true";
  res.json(listTasks({ completed: completedBool }));
});

router.post("/", (req: Request, res: Response) => {
  const result = validateTask(req.body ?? {}, { partial: false });
  if (!result.valid) {
    return res.status(400).json({ errors: result.errors });
  }
  const task = createTask({ title: req.body.title, completed: req.body.completed });
  res.status(201).json(task);
});

router.patch("/:id", (req: Request, res: Response) => {
  const result = validateTask(req.body ?? {}, { partial: true });
  if (!result.valid) {
    return res.status(400).json({ errors: result.errors });
  }
  const task = updateTask(req.params.id, {
    title: req.body.title,
    completed: req.body.completed,
  });
  if (!task) {
    return res.status(404).json({ error: "not found" });
  }
  res.json(task);
});

router.delete("/:id", (req: Request, res: Response) => {
  const deleted = deleteTask(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "not found" });
  }
  res.status(204).send();
});

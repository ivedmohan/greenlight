import express from "express";
import { router } from "./routes.js";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/tasks", router);
  return app;
}

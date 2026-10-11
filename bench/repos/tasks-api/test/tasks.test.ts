import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { resetStore } from "../src/store.js";

const app = createApp();

beforeEach(() => {
  resetStore();
});

describe("GET /tasks", () => {
  it("returns an empty list initially", async () => {
    const res = await request(app).get("/tasks");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("filters by completed=true", async () => {
    await request(app).post("/tasks").send({ title: "a" });
    const createdB = await request(app).post("/tasks").send({ title: "b" });
    await request(app).patch(`/tasks/${createdB.body.id}`).send({ completed: true });

    const res = await request(app).get("/tasks?completed=true");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe("b");
  });

  it("filters by completed=false", async () => {
    await request(app).post("/tasks").send({ title: "a" });
    const createdB = await request(app).post("/tasks").send({ title: "b" });
    await request(app).patch(`/tasks/${createdB.body.id}`).send({ completed: true });

    const res = await request(app).get("/tasks?completed=false");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe("a");
  });
});

describe("POST /tasks", () => {
  it("creates a task with a valid title", async () => {
    const res = await request(app).post("/tasks").send({ title: "write tests" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: "write tests", completed: false });
  });

  it("rejects an empty title", async () => {
    const res = await request(app).post("/tasks").send({ title: "" });
    expect(res.status).toBe(400);
  });

  it("rejects a whitespace-only title", async () => {
    const res = await request(app).post("/tasks").send({ title: "   " });
    expect(res.status).toBe(400);
  });

  it("rejects a title over 100 characters", async () => {
    const res = await request(app).post("/tasks").send({ title: "x".repeat(101) });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /tasks/:id", () => {
  it("updates only the provided fields, title omitted", async () => {
    const created = await request(app).post("/tasks").send({ title: "original" });
    const res = await request(app).patch(`/tasks/${created.body.id}`).send({ completed: true });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("original");
    expect(res.body.completed).toBe(true);
  });

  it("rejects an empty-string title on update", async () => {
    const created = await request(app).post("/tasks").send({ title: "original" });
    const res = await request(app).patch(`/tasks/${created.body.id}`).send({ title: "" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown id", async () => {
    const res = await request(app).patch("/tasks/does-not-exist").send({ title: "x" });
    expect(res.status).toBe(404);
  });

  it("persists the update so a subsequent GET reflects it", async () => {
    const created = await request(app).post("/tasks").send({ title: "original" });
    await request(app).patch(`/tasks/${created.body.id}`).send({ title: "changed" });
    const res = await request(app).get("/tasks");
    expect(res.body.find((t: any) => t.id === created.body.id).title).toBe("changed");
  });
});

describe("DELETE /tasks/:id", () => {
  it("removes the task", async () => {
    const created = await request(app).post("/tasks").send({ title: "to delete" });
    const del = await request(app).delete(`/tasks/${created.body.id}`);
    expect(del.status).toBe(204);

    const res = await request(app).get("/tasks");
    expect(res.body.find((t: any) => t.id === created.body.id)).toBeUndefined();
  });

  it("returns 404 for an unknown id", async () => {
    const res = await request(app).delete("/tasks/does-not-exist");
    expect(res.status).toBe(404);
  });
});

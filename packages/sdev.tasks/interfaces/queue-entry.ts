import { TaskType } from "../interfaces/task-type.ts";

export interface QueueEntry {
  userId: string;
  type: TaskType;
  body: string;
  payload?: Record<string, unknown>;
}

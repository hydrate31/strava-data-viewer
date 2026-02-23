import { useEffect, useRef, useState } from "preact/hooks";
import { TaskType } from "../packages/sdev.tasks/interfaces/task-type.ts";
import TimeAgo from "../components/TimeAgo.tsx";
import { type DataQualityFixAction } from "../packages/sdev.tasks/tasks/fix-data-quality.ts";

export interface TaskRow {
  type: TaskType;
  name: string;
  state: {
    status: string;
    percentage: number;
    updatedAt: string;
    startedAt: string | null;
    error: string | null;
  };
}

interface TasksTableProps {
  initialTasks: TaskRow[];
}

const dataQualityFixOptions: { value: DataQualityFixAction; label: string }[] =
  [
    { value: "dedupe_activities", label: "Deduplicate activities" },
    { value: "repair_timestamps", label: "Repair timestamps" },
    { value: "remove_malformed_records", label: "Remove malformed records" },
    { value: "remove_orphan_media", label: "Quarantine orphan media" },
  ];

const clamp = (value: number) => Math.max(0, Math.min(100, Math.floor(value)));

const runningSince = (startedAt: string | null) => {
  if (!startedAt) return "-";
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return "-";
  const delta = Math.max(0, Date.now() - start);
  const seconds = Math.floor(delta / 1000) % 60;
  const minutes = Math.floor(delta / (1000 * 60)) % 60;
  const hours = Math.floor(delta / (1000 * 60 * 60));
  return `${hours}h ${minutes}m ${seconds}s`;
};

export default function TasksTable({ initialTasks }: TasksTableProps) {
  const [tasks, setTasks] = useState<TaskRow[]>(initialTasks);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    const isUserInteracting = () => {
      const active = globalThis.document?.activeElement;
      const table = tableRef.current;
      if (!active || !table || !table.contains(active)) return false;
      const tag = active.tagName.toLowerCase();
      return tag === "select" || tag === "option" || tag === "input" ||
        tag === "button" || tag === "textarea";
    };

    const poll = async () => {
      if (isUserInteracting()) return;
      try {
        const response = await fetch("/tasks?format=json", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!Array.isArray(data?.tasks)) return;
        setTasks(data.tasks as TaskRow[]);
      } catch {
        // Keep existing rows if polling fails.
      }
    };

    const id = globalThis.setInterval(poll, 2000);
    return () => globalThis.clearInterval(id);
  }, []);

  return (
    <table ref={tableRef}>
      <thead>
        <tr>
          <th>Task</th>
          <th>Status</th>
          <th>Updated At</th>
          <th>Running Since</th>
          <th>Error</th>
          <th>Progress</th>
          <th>Run</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr>
            <td>{task.name}</td>
            <td>{task.state.status}</td>
            <td>
              <TimeAgo value={task.state.updatedAt || null} />
            </td>
            <td>{runningSince(task.state.startedAt)}</td>
            <td>{task.state.error || "-"}</td>
            <td>
              <div
                class="task-progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={clamp(task.state.percentage)}
              >
                <div
                  class="task-progress-fill"
                  style={`width: ${clamp(task.state.percentage)}%;`}
                />
                <span class="task-progress-label">
                  {clamp(task.state.percentage)}%
                </span>
              </div>
            </td>
            <td>
              {task.state.status === "running" && (
                <form
                  method="post"
                  onSubmit={(event) => {
                    if (
                      !globalThis.confirm(
                        "Force stop this task? This will request cancellation immediately.",
                      )
                    ) {
                      event.preventDefault();
                    }
                  }}
                >
                  <input
                    type="hidden"
                    name="task_type"
                    value={task.type.toString()}
                  />
                  <input type="hidden" name="action" value="force_stop" />
                  <input type="hidden" name="confirm_force_stop" value="yes" />
                  <button type="submit" class="danger">Force Stop</button>
                </form>
              )}

              {task.state.status !== "running" &&
                task.type === TaskType.DataQualityFix && (
                <form method="post">
                  <input
                    type="hidden"
                    name="task_type"
                    value={task.type.toString()}
                  />
                  <input type="hidden" name="action" value="run" />
                  <select name="fix_action">
                    {dataQualityFixOptions.map((option) => (
                      <option value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={task.state.status === "queued"}
                  >
                    Run
                  </button>
                </form>
              )}

              {task.state.status !== "running" &&
                task.type !== TaskType.DataQualityFix && (
                <form method="post">
                  <input
                    type="hidden"
                    name="task_type"
                    value={task.type.toString()}
                  />
                  <input type="hidden" name="action" value="run" />
                  <button
                    type="submit"
                    disabled={task.state.status === "queued"}
                  >
                    Run
                  </button>
                </form>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

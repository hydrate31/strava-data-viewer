export interface StateAction {
  href: string;
  label: string;
  primary?: boolean;
}

interface StatePanelProps {
  title: string;
  description?: string;
  kind?: "empty" | "error" | "info";
  actions?: StateAction[];
}

export default function StatePanel(
  { title, description, kind = "empty", actions = [] }: StatePanelProps,
) {
  return (
    <div class={`state-panel is-${kind}`}>
      <h4>{title}</h4>
      {description && <p>{description}</p>}
      {actions.length > 0 && (
        <div class="state-panel-actions">
          {actions.map((action) => (
            <a
              href={action.href}
              class={action.primary ? "button-link primary" : "button-link"}
            >
              {action.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

import {
  formatAbsoluteDate,
  formatTimeAgo,
  parseDateInput,
} from "../helpers/timeAgo.ts";

interface TimeAgoProps {
  value: string | number | Date | null | undefined;
}

export default function TimeAgo({ value }: TimeAgoProps) {
  const date = parseDateInput(value);
  if (!date) return <>-</>;

  return (
    <time dateTime={date.toISOString()} title={formatAbsoluteDate(date)}>
      {formatTimeAgo(date)}
    </time>
  );
}

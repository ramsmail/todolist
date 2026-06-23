interface Props {
  name:  string;
  color: string;
}

export function LabelChip({ name, color }: Props) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full"
      style={{ color, backgroundColor: `${color}1a` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      {name}
    </span>
  );
}

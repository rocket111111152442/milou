export default function UnreadBadge({ count }: { count: number }) {
  if (!count || count <= 0) return null;
  const label = count > 9 ? '9+' : String(count);
  return (
    <span
      className="inline-flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none"
      aria-label={`${count} message${count > 1 ? 's' : ''} non lu${count > 1 ? 's' : ''}`}
    >
      {label}
    </span>
  );
}

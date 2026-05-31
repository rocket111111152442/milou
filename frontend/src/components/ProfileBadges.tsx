'use client';

export default function ProfileBadges({
  badges,
}: {
  badges?: { id: string; label: string; className: string }[];
}) {
  if (!badges?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => (
        <span key={b.id} className={`badge border text-xs ${b.className}`}>
          {b.label}
        </span>
      ))}
    </div>
  );
}

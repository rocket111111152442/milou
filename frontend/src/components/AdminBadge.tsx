import { IconShield } from '@/components/ui/Icons';

export default function AdminBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/25 ${
        size === 'md' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs'
      }`}
    >
      <IconShield className={size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
      Admin
    </span>
  );
}

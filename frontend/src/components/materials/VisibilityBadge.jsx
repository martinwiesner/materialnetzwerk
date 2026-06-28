import { Globe, Lock, Users, Building2 } from 'lucide-react';

const CONFIG = {
  public:        { label: 'Öffentlich',     Icon: Globe,      color: 'bg-green-100 text-green-700 border-green-200' },
  actor:         { label: 'Mein Akteur',    Icon: Building2,  color: 'bg-blue-100 text-blue-700 border-blue-200' },
  selectedUsers: { label: 'Ausgewählte',    Icon: Users,      color: 'bg-amber-100 text-amber-700 border-amber-200' },
  private:       { label: 'Privat',         Icon: Lock,       color: 'bg-stone-100 text-stone-600 border-stone-200' },
};

export default function VisibilityBadge({ visibility = 'private', className = '' }) {
  const cfg = CONFIG[visibility] ?? CONFIG.private;
  const { Icon, label, color } = cfg;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${color} ${className}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

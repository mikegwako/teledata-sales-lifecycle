import { Badge } from '@/components/ui/badge';

const roleStyles: Record<string, string> = {
  admin: 'bg-primary/15 text-primary border-primary/30',
  staff: 'bg-accent/15 text-accent border-accent/30',
  client: 'bg-success/15 text-success border-success/30',
};

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  staff: 'Staff',
  client: 'Client',
};

export function RoleBadge({ role }: { role: string }) {
  return (
    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 font-medium ${roleStyles[role] || ''}`}>
      {roleLabels[role] || role}
    </Badge>
  );
}

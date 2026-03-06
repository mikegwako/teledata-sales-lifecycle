import { useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const SERVICE_CATEGORIES = [
  {
    label: 'Internet & Connectivity',
    services: ['High-Speed Fiber', 'Dedicated Internet (DIA)', 'Fixed Wireless', 'SD-WAN', 'Broadband Aggregation', 'Satellite/VSAT'],
  },
  {
    label: 'ICT & Managed Services',
    services: ['Managed ICT Support', 'Hardware Supply', 'Systems Integration', 'Software Development', 'Structured Cabling'],
  },
  {
    label: 'Security Solutions',
    services: ['Cybersecurity', 'CCTV', 'Biometrics', 'Alarms & BMS'],
  },
  {
    label: 'Communication & AV',
    services: ['VoIP', 'Enterprise Mobility', 'Audio Visual & Digital Signage'],
  },
  {
    label: 'Cloud & Power',
    services: ['Cloud Computing', 'Backup & Disaster Recovery', 'UPS & Power Backup', 'IoT & Big Data'],
  },
];

interface ServiceTypeComboboxProps {
  value: string;
  onChange: (value: string) => void;
}

export function ServiceTypeCombobox({ value, onChange }: ServiceTypeComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = SERVICE_CATEGORIES.map((cat) => ({
    ...cat,
    services: cat.services.filter((s) => s.toLowerCase().includes(search.toLowerCase())),
  })).filter((cat) => cat.services.length > 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          {value || 'Select a service...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search services..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No services found.</p>
          ) : (
            filtered.map((cat) => (
              <div key={cat.label}>
                <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{cat.label}</p>
                {cat.services.map((service) => (
                  <button
                    key={service}
                    className={cn(
                      'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                      value === service && 'bg-accent text-accent-foreground'
                    )}
                    onClick={() => {
                      onChange(service);
                      setOpen(false);
                      setSearch('');
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === service ? 'opacity-100' : 'opacity-0')} />
                    {service}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

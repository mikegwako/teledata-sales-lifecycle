import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Search, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';

interface ClientInfo {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  avatar_position: string;
  phone_number: string | null;
  created_at: string | null;
  total_projects: number;
  active_projects: number;
  total_value: number;
  total_profit: number;
}

export default function AdminClientList() {
  const { role } = useAuth();
  const { formatCurrency } = useCurrency();
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchClients = async () => {
      setLoading(true);

      // Get all client role users
      const { data: clientRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'client');

      if (!clientRoles || clientRoles.length === 0) { setLoading(false); return; }

      const clientIds = clientRoles.map(r => r.user_id);

      const [{ data: profiles }, { data: deals }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, avatar_url, avatar_position, phone_number, created_at').in('id', clientIds),
        supabase.from('deals').select('client_id, status, value, cost').in('client_id', clientIds),
      ]);

      const dealsByClient = new Map<string, typeof deals>();
      (deals || []).forEach(d => {
        if (!d.client_id) return;
        const arr = dealsByClient.get(d.client_id) || [];
        arr.push(d);
        dealsByClient.set(d.client_id, arr);
      });

      const completedStatuses = ['Completed', 'Closed Won'];
      const activeStatuses = ['Inception', 'In Progress', 'Survey', 'Proposal Sent'];

      setClients((profiles || []).map(p => {
        const clientDeals = dealsByClient.get(p.id) || [];
        return {
          id: p.id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          avatar_position: p.avatar_position,
          phone_number: p.phone_number,
          created_at: p.created_at,
          total_projects: clientDeals.length,
          active_projects: clientDeals.filter(d => activeStatuses.includes(d.status || '')).length,
          total_value: clientDeals.reduce((sum, d) => sum + (d.value || 0), 0),
          total_profit: clientDeals.reduce((sum, d) => sum + ((d.value || 0) - (d.cost || 0)), 0),
        };
      }));
      setLoading(false);
    };
    fetchClients();
  }, []);

  const filtered = clients.filter(c =>
    c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone_number?.includes(search)
  );

  const exportToExcel = () => {
    const exportData = filtered.map(c => ({
      'Client': c.full_name || 'Unknown',
      'Phone': c.phone_number || 'N/A',
      'Total Projects': c.total_projects,
      'Active Projects': c.active_projects,
      'Total Value': c.total_value,
      'Total Profit': c.total_profit,
      'Joined': c.created_at ? new Date(c.created_at).toLocaleDateString() : 'N/A',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients');
    XLSX.writeFile(wb, `Clients_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Exported successfully');
  };

  if (role !== 'admin') return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 font-display">
              <Users className="h-5 w-5 text-primary" />
              All Clients ({filtered.length})
            </CardTitle>
            <Button onClick={exportToExcel} variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Export Excel
            </Button>
          </div>
          <div className="relative mt-3 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              className="pl-8 h-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-center">Projects</TableHead>
                    <TableHead className="text-center">Active</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    <TableHead className="text-right">Total Profit</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No clients found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(c => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <UserAvatar
                              fullName={c.full_name}
                              avatarUrl={c.avatar_url}
                              avatarPosition={c.avatar_position}
                              className="h-7 w-7"
                              fallbackClassName="text-[9px]"
                            />
                            <span className="font-medium text-sm">{c.full_name || 'Unknown'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.phone_number || '—'}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="text-xs">{c.total_projects}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs text-primary">{c.active_projects}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatAmount(c.total_value)}</TableCell>
                        <TableCell className={`text-right text-sm font-semibold ${c.total_profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                          {formatAmount(c.total_profit)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Download, Search, FolderOpen, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import * as XLSX from 'xlsx';

interface Deal {
  id: string;
  deal_number: number;
  title: string;
  status: string | null;
  value: number | null;
  cost: number | null;
  service_type: string | null;
  created_at: string | null;
  client_name: string | null;
  staff_name: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  'Inception': 'bg-muted text-muted-foreground',
  'In Progress': 'bg-primary/10 text-primary',
  'Completed': 'bg-green-500/10 text-green-600',
  'Survey': 'bg-blue-500/10 text-blue-600',
  'Proposal Sent': 'bg-yellow-500/10 text-yellow-700',
  'Closed Won': 'bg-green-600/10 text-green-700',
  'Closed Lost': 'bg-destructive/10 text-destructive',
};

export default function AdminProjectList() {
  const { role } = useAuth();
  const { formatCurrency } = useCurrency();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchDeals = async () => {
    setLoading(true);
    const { data: rawDeals } = await supabase
      .from('deals')
      .select('id, deal_number, title, status, value, cost, service_type, created_at, client_id, assigned_to')
      .order('created_at', { ascending: false });

    if (!rawDeals) { setLoading(false); return; }

    // Get all unique user IDs
    const userIds = new Set<string>();
    rawDeals.forEach(d => {
      if (d.client_id) userIds.add(d.client_id);
      if (d.assigned_to) userIds.add(d.assigned_to);
    });

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', Array.from(userIds));

    const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name]));

    setDeals(rawDeals.map(d => ({
      id: d.id,
      deal_number: d.deal_number,
      title: d.title,
      status: d.status,
      value: d.value,
      cost: d.cost,
      service_type: d.service_type,
      created_at: d.created_at,
      client_name: d.client_id ? profileMap.get(d.client_id) || 'Unknown' : 'N/A',
      staff_name: d.assigned_to ? profileMap.get(d.assigned_to) || 'Unassigned' : 'Unassigned',
    })));
    setLoading(false);
  };

  useEffect(() => { fetchDeals(); }, []);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('deals').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete project');
    } else {
      setDeals(prev => prev.filter(d => d.id !== id));
      toast.success('Project deleted');
    }
    setDeleteTarget(null);
  };

  const statuses = [...new Set(deals.map(d => d.status).filter(Boolean))] as string[];

  const filtered = deals.filter(d => {
    const matchesSearch = d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.staff_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.service_type?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const exportToExcel = () => {
    const exportData = filtered.map(d => ({
      'Deal #': d.deal_number,
      'Title': d.title,
      'Status': d.status || 'N/A',
      'Service Type': d.service_type || 'N/A',
      'Client': d.client_name,
      'Staff Assigned': d.staff_name,
      'Value': d.value || 0,
      'Cost': d.cost || 0,
      'Profit': (d.value || 0) - (d.cost || 0),
      'Created': d.created_at ? new Date(d.created_at).toLocaleDateString() : 'N/A',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Projects');
    XLSX.writeFile(wb, `Projects_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Exported successfully');
  };

  if (role !== 'admin') return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 font-display">
              <FolderOpen className="h-5 w-5 text-primary" />
              All Projects ({filtered.length})
            </CardTitle>
            <Button onClick={exportToExcel} variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Export Excel
            </Button>
          </div>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search projects, clients, staff..."
                className="pl-8 h-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statuses.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                        No projects found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(d => {
                      const profit = (d.value || 0) - (d.cost || 0);
                      return (
                        <TableRow key={d.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">{d.deal_number}</TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate">{d.title}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`text-[10px] ${STATUS_COLORS[d.status || ''] || ''}`}>
                              {d.status || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{d.service_type || '—'}</TableCell>
                          <TableCell className="text-sm">{d.client_name}</TableCell>
                          <TableCell className="text-sm">{d.staff_name}</TableCell>
                          <TableCell className="text-right text-sm font-medium">{formatAmount(d.value || 0)}</TableCell>
                          <TableCell className="text-right text-sm">{formatAmount(d.cost || 0)}</TableCell>
                          <TableCell className={`text-right text-sm font-semibold ${profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                            {formatAmount(profit)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteTarget(d.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this project and all related data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

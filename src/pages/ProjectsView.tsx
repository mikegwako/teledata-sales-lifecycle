import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Trash2, MessageSquare, Send, Pencil, Save, X, FolderOpen, Plus, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ServiceTypeCombobox } from '@/components/ServiceTypeCombobox';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profile?: { full_name: string } | null;
}

interface Deal {
  id: string;
  title: string;
  service_type: string;
  value: number;
  cost: number;
  status: string;
  description: string;
  created_at: string;
  client_id: string;
  assigned_to: string | null;
  deal_number: number;
  profiles?: { full_name: string } | null;
  assigned_profile?: { full_name: string } | null;
}

const STAGES = ['Inception', 'Discovery', 'Proposal', 'Negotiation', 'Implementation', 'Completion'];

const stageColors: Record<string, string> = {
  Inception: 'bg-muted text-muted-foreground',
  Discovery: 'bg-primary/10 text-primary',
  Proposal: 'bg-accent/10 text-accent',
  Negotiation: 'bg-warning/10 text-warning',
  Implementation: 'bg-primary/20 text-primary',
  Completion: 'bg-success/10 text-success',
};

export default function ProjectsView() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [expandedDeal, setExpandedDeal] = useState<string | null>(null);
  const [editingDeal, setEditingDeal] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', service_type: '' });

  const fetchDeals = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('deals')
      .select('*, profiles!deals_client_id_fkey(full_name), assigned_profile:profiles!deals_assigned_to_fkey(full_name)')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setDeals((data as any) || []);
    }
    setLoading(false);
  };

  const fetchComments = async (dealId: string) => {
    const { data } = await supabase
      .from('comments')
      .select('*, profile:profiles!comments_user_id_fkey(full_name)')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: true });
    setComments((prev) => ({ ...prev, [dealId]: (data as any) || [] }));
  };

  useEffect(() => { fetchDeals(); }, []);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('deals').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setDeals(deals.filter((d) => d.id !== id));
      toast({ title: 'Deal deleted' });
    }
  };

  const handleComment = async (dealId: string) => {
    const content = newComment[dealId]?.trim();
    if (!content || !user) return;
    const { error } = await supabase.from('comments').insert({ deal_id: dealId, user_id: user.id, content });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setNewComment((prev) => ({ ...prev, [dealId]: '' }));
      fetchComments(dealId);
    }
  };

  const startEdit = (deal: Deal) => {
    setEditingDeal(deal.id);
    setEditForm({ title: deal.title, description: deal.description || '', service_type: deal.service_type || '' });
  };

  const saveEdit = async (dealId: string) => {
    const { error } = await supabase.from('deals').update(editForm).eq('id', dealId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setEditingDeal(null);
      fetchDeals();
      toast({ title: 'Deal updated' });
    }
  };

  const toggleComments = (dealId: string) => {
    if (expandedDeal === dealId) {
      setExpandedDeal(null);
    } else {
      setExpandedDeal(dealId);
      if (!comments[dealId]) fetchComments(dealId);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Empty state for clients
  if (deals.length === 0 && role === 'client') {
    return (
      <div className="animate-fade-in flex items-center justify-center py-20">
        <Card className="shadow-elevated max-w-lg w-full text-center">
          <CardContent className="py-16 px-8">
            <div className="h-20 w-20 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-6">
              <FolderOpen className="h-10 w-10 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-bold font-display text-foreground mb-2">Welcome to Teledata Africa</h2>
            <p className="text-muted-foreground mb-8">You don't have any projects yet. Get started by creating your first project and let our team bring your vision to life.</p>
            <Button size="lg" className="gradient-primary text-primary-foreground" onClick={() => navigate('/new-project')}>
              <Plus className="mr-2 h-5 w-5" />
              Create Your First Project
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display text-foreground">
          {role === 'client' ? 'My Projects' : role === 'staff' ? 'My Deals' : 'All Projects'}
        </h1>
        <p className="text-muted-foreground mt-1">{deals.length} project{deals.length !== 1 ? 's' : ''} found</p>
      </div>

      <div className="space-y-4">
        {deals.map((deal) => {
          const stageIndex = STAGES.indexOf(deal.status);
          const isEditing = editingDeal === deal.id;

          return (
            <Card key={deal.id} className="shadow-card hover:shadow-elevated transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-mono font-bold text-primary">#{1000 + (deal.deal_number || 0)}</span>
                    </div>
                    <div>
                      {isEditing ? (
                        <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="text-base font-bold" />
                      ) : (
                        <CardTitle className="text-base font-display">{deal.title}</CardTitle>
                      )}
                      <p className="text-sm text-muted-foreground">
                        <span className="font-mono text-xs text-primary/70">TD-{1000 + (deal.deal_number || 0)}</span>
                        {' • '}{deal.service_type || 'Unspecified'}
                        {' • '}{deal.profiles?.full_name || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={stageColors[deal.status]}>{deal.status}</Badge>
                    {deal.value > 0 && <Badge variant="outline" className="font-mono">${Number(deal.value).toLocaleString()}</Badge>}
                    {deal.assigned_profile && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <div className="h-6 w-6 rounded-full gradient-accent flex items-center justify-center">
                          <span className="text-[10px] font-bold text-accent-foreground">{deal.assigned_profile.full_name?.charAt(0)?.toUpperCase()}</span>
                        </div>
                        <span className="hidden sm:inline">{deal.assigned_profile.full_name}</span>
                      </div>
                    )}
                    {role === 'client' && !isEditing && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(deal)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {isEditing && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-success" onClick={() => saveEdit(deal.id)}><Save className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingDeal(null)}><X className="h-4 w-4" /></Button>
                      </>
                    )}
                    {role === 'admin' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(deal.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div className="space-y-3 mb-3">
                    <div>
                      <Label className="text-xs">Service Type</Label>
                      <ServiceTypeCombobox value={editForm.service_type} onChange={(v) => setEditForm({ ...editForm, service_type: v })} />
                    </div>
                    <div>
                      <Label className="text-xs">Description</Label>
                      <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} />
                    </div>
                  </div>
                ) : null}

                {/* Progress Stepper */}
                <div className="flex items-center gap-1">
                  {STAGES.map((stage, i) => (
                    <div key={stage} className="flex-1 group relative">
                      <div className={`h-2 rounded-full transition-colors ${i <= stageIndex ? 'gradient-primary' : 'bg-muted'}`} />
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{stage}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">Inception</span>
                  <span className="text-[10px] text-muted-foreground">Completion</span>
                </div>

                {!isEditing && deal.description && (
                  <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{deal.description}</p>
                )}

                {/* Comments Toggle */}
                <div className="mt-3 pt-3 border-t border-border">
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => toggleComments(deal.id)}>
                    <MessageSquare className="h-3 w-3 mr-1" />
                    {expandedDeal === deal.id ? 'Hide Comments' : 'Comments'}
                    {comments[deal.id]?.length ? ` (${comments[deal.id].length})` : ''}
                  </Button>

                  {expandedDeal === deal.id && (
                    <div className="mt-2 space-y-2">
                      {(comments[deal.id] || []).map((c) => (
                        <div key={c.id} className="bg-muted/50 rounded-lg p-2 text-sm">
                          <span className="font-medium text-foreground">{(c as any).profile?.full_name || 'User'}</span>
                          <span className="text-muted-foreground text-xs ml-2">{new Date(c.created_at).toLocaleDateString()}</span>
                          <p className="text-foreground mt-0.5">{c.content}</p>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add a comment..."
                          value={newComment[deal.id] || ''}
                          onChange={(e) => setNewComment((prev) => ({ ...prev, [deal.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && handleComment(deal.id)}
                          className="text-sm"
                        />
                        <Button size="icon" className="shrink-0" onClick={() => handleComment(deal.id)}>
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

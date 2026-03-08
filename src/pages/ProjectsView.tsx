import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageSquare, Send, Pencil, Save, X, FolderOpen, Plus, User, Paperclip, Upload, Download, FileText, Image as ImageIcon, Trash2, ShieldAlert, AtSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Label } from '@/components/ui/label';
import { ServiceTypeCombobox } from '@/components/ServiceTypeCombobox';
import { RoleBadge } from '@/components/RoleBadge';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useCurrency } from '@/hooks/useCurrency';
import { UserAvatar } from '@/components/UserAvatar';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profile?: { full_name: string; avatar_url: string | null; avatar_position: string } | null;
}

interface Document {
  id: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  content_type: string;
  created_at: string;
  uploaded_by: string;
  uploader?: { full_name: string; avatar_url: string | null; avatar_position: string } | null;
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
  profiles?: { full_name: string; avatar_url: string | null; avatar_position: string } | null;
  assigned_profile?: { full_name: string; avatar_url: string | null; avatar_position: string } | null;
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
  const { user, role, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const roleMap = useUserRoles();
  const { formatCurrency } = useCurrency();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [documents, setDocuments] = useState<Record<string, Document[]>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [expandedDeal, setExpandedDeal] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<Record<string, 'comments' | 'documents' | null>>({});
  const [editingDeal, setEditingDeal] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', service_type: '' });
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchDeals = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('deals')
      .select('*, profiles!deals_client_id_fkey(full_name, avatar_url, avatar_position), assigned_profile:profiles!deals_assigned_to_fkey(full_name, avatar_url, avatar_position)')
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

  const fetchDocuments = async (dealId: string) => {
    const { data } = await supabase
      .from('documents')
      .select('*, uploader:profiles!documents_uploaded_by_fkey(full_name)')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false });
    setDocuments((prev) => ({ ...prev, [dealId]: (data as any) || [] }));
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

  const frozenActions = profile?.frozen_actions || [];
  const canComment = !frozenActions.includes('comment');
  const canUpload = !frozenActions.includes('upload');

  const handleComment = async (dealId: string) => {
    const content = newComment[dealId]?.trim();
    if (!content || !user) return;
    if (!canComment) {
      toast({ title: 'Action restricted', description: 'Your commenting privileges have been suspended.', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('comments').insert({ deal_id: dealId, user_id: user.id, content });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setNewComment((prev) => ({ ...prev, [dealId]: '' }));
      fetchComments(dealId);
    }
  };

  const handleDeleteComment = async (dealId: string, commentId: string) => {
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Comment deleted' });
      fetchComments(dealId);
    }
  };

  const handleFileUpload = async (dealId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.length) return;
    if (!canUpload) {
      toast({ title: 'Action restricted', description: 'Your upload privileges have been suspended.', variant: 'destructive' });
      return;
    }
    setUploading((prev) => ({ ...prev, [dealId]: true }));
    const file = e.target.files[0];
    const path = `${dealId}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file);
    if (uploadError) {
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
      setUploading((prev) => ({ ...prev, [dealId]: false }));
      return;
    }

    await supabase.from('documents').insert({
      deal_id: dealId, uploaded_by: user.id, file_name: file.name,
      storage_path: path, file_size: file.size, content_type: file.type,
    });

    toast({ title: 'Document uploaded' });
    fetchDocuments(dealId);
    setUploading((prev) => ({ ...prev, [dealId]: false }));
    const ref = fileInputRefs.current[dealId];
    if (ref) ref.value = '';
  };

  const handleDownload = async (doc: Document) => {
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const handleDeleteDoc = async (dealId: string, doc: Document) => {
    await supabase.storage.from('documents').remove([doc.storage_path]);
    await supabase.from('documents').delete().eq('id', doc.id);
    fetchDocuments(dealId);
    toast({ title: 'Document removed' });
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

  const toggleSection = (dealId: string, section: 'comments' | 'documents') => {
    const current = expandedSection[dealId];
    if (current === section) {
      setExpandedSection((prev) => ({ ...prev, [dealId]: null }));
    } else {
      setExpandedSection((prev) => ({ ...prev, [dealId]: section }));
      if (section === 'comments' && !comments[dealId]) fetchComments(dealId);
      if (section === 'documents' && !documents[dealId]) fetchDocuments(dealId);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (deals.length === 0 && role === 'client') {
    return (
      <div className="animate-fade-in flex items-center justify-center py-20 px-4">
        <Card className="shadow-elevated max-w-lg w-full text-center">
          <CardContent className="py-12 sm:py-16 px-6 sm:px-8">
            <div className="h-20 w-20 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-6">
              <FolderOpen className="h-10 w-10 text-primary-foreground" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground mb-2">Welcome to Teledata Africa</h2>
            <p className="text-muted-foreground mb-8">You don't have any projects yet. Get started by creating your first project and let our team bring your vision to life.</p>
            <Button size="lg" className="gradient-primary text-primary-foreground" onClick={() => navigate('/new-project')}>
              <Plus className="mr-2 h-5 w-5" />Create Your First Project
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold font-display text-foreground">
          {role === 'client' ? 'My Projects' : role === 'staff' ? 'My Deals' : 'All Projects'}
        </h1>
        <p className="text-muted-foreground mt-1">{deals.length} project{deals.length !== 1 ? 's' : ''} found</p>
      </div>

      <div className="space-y-4">
        {deals.map((deal) => {
          const stageIndex = STAGES.indexOf(deal.status);
          const isEditing = editingDeal === deal.id;
          const activeSection = expandedSection[deal.id];

          return (
            <Card key={deal.id} className="shadow-card hover:shadow-elevated transition-shadow">
              <CardHeader className="pb-3 px-4 sm:px-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-mono font-bold text-primary">#{1000 + (deal.deal_number || 0)}</span>
                    </div>
                    <div className="min-w-0">
                      {isEditing ? (
                        <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="text-base font-bold" />
                      ) : (
                        <CardTitle className="text-base font-display truncate">{deal.title}</CardTitle>
                      )}
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        <span className="font-mono text-xs text-primary/70">TD-{1000 + (deal.deal_number || 0)}</span>
                        {' • '}{deal.service_type || 'Unspecified'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={stageColors[deal.status]}>{deal.status}</Badge>
                    {deal.value > 0 && <Badge variant="outline" className="font-mono">{formatCurrency(Number(deal.value))}</Badge>}
                    {deal.assigned_profile && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <div className="h-6 w-6 rounded-full gradient-accent flex items-center justify-center">
                          <span className="text-[10px] font-bold text-accent-foreground">{deal.assigned_profile.full_name?.charAt(0)?.toUpperCase()}</span>
                        </div>
                        <span className="hidden sm:inline">{deal.assigned_profile.full_name}</span>
                      </div>
                    )}
                    {(role === 'client') && !isEditing && (
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
              <CardContent className="px-4 sm:px-6">
                {isEditing && (
                  <div className="space-y-3 mb-3">
                    <div><Label className="text-xs">Service Type</Label><ServiceTypeCombobox value={editForm.service_type} onChange={(v) => setEditForm({ ...editForm, service_type: v })} /></div>
                    <div><Label className="text-xs">Description</Label><Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} /></div>
                  </div>
                )}

                {/* Progress */}
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

                {/* Comments & Documents Toggle */}
                <div className="mt-3 pt-3 border-t border-border flex gap-2 flex-wrap">
                  <Button variant={activeSection === 'comments' ? 'secondary' : 'ghost'} size="sm" className="text-xs" onClick={() => toggleSection(deal.id, 'comments')}>
                    <MessageSquare className="h-3 w-3 mr-1" />Comments
                    {comments[deal.id]?.length ? ` (${comments[deal.id].length})` : ''}
                  </Button>
                  <Button variant={activeSection === 'documents' ? 'secondary' : 'ghost'} size="sm" className="text-xs" onClick={() => toggleSection(deal.id, 'documents')}>
                    <Paperclip className="h-3 w-3 mr-1" />Documents
                    {documents[deal.id]?.length ? ` (${documents[deal.id].length})` : ''}
                  </Button>
                </div>

                {/* Comments Section */}
                {activeSection === 'comments' && (
                  <div className="mt-3 space-y-2">
                    {(comments[deal.id] || []).map((c) => (
                      <div key={c.id} className="bg-muted/50 rounded-lg p-2.5 text-sm group flex gap-2">
                        <div className="h-6 w-6 rounded-full gradient-primary flex items-center justify-center shrink-0">
                          <span className="text-[9px] font-bold text-primary-foreground">{c.profile?.full_name?.charAt(0)?.toUpperCase() || '?'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-foreground">{c.profile?.full_name || 'User'}</span>
                              {roleMap[c.user_id] && <RoleBadge role={roleMap[c.user_id]} />}
                              <span className="text-muted-foreground text-xs">{new Date(c.created_at).toLocaleDateString()}</span>
                            </div>
                            {(role === 'admin' || c.user_id === user?.id) && (
                              <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteComment(deal.id, c.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          <p className="text-foreground mt-0.5">{c.content}</p>
                        </div>
                      </div>
                    ))}
                    {comments[deal.id]?.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-3">No comments yet</p>
                    )}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a comment..."
                        value={newComment[deal.id] || ''}
                        onChange={(e) => setNewComment((prev) => ({ ...prev, [deal.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && handleComment(deal.id)}
                        className="text-sm"
                      />
                      <Button size="icon" className="shrink-0 gradient-primary text-primary-foreground" onClick={() => handleComment(deal.id)}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Documents Section */}
                {activeSection === 'documents' && (
                  <div className="mt-3 space-y-2">
                    <input
                      ref={(el) => { fileInputRefs.current[deal.id] = el; }}
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx"
                      onChange={(e) => handleFileUpload(deal.id, e)}
                    />
                    <Button
                      variant="outline" size="sm" className="w-full border-dashed text-xs"
                      onClick={() => fileInputRefs.current[deal.id]?.click()}
                      disabled={uploading[deal.id]}
                    >
                      {uploading[deal.id] ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                      {uploading[deal.id] ? 'Uploading...' : 'Upload Document'}
                    </Button>

                    {(documents[deal.id] || []).map((doc) => (
                      <div key={doc.id} className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/30 transition-colors text-sm">
                        {doc.content_type?.startsWith('image/') ? <ImageIcon className="h-4 w-4 text-accent shrink-0" /> : <FileText className="h-4 w-4 text-primary shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{doc.file_name}</p>
                          <p className="text-[10px] text-muted-foreground">{formatFileSize(doc.file_size)} • {doc.uploader?.full_name || 'Unknown'}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleDownload(doc)}>
                          <Download className="h-3 w-3" />
                        </Button>
                        {(role === 'admin' || doc.uploaded_by === user?.id) && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteDoc(deal.id, doc)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {documents[deal.id]?.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-3">No documents yet</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

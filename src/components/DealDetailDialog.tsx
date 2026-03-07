import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Send, Upload, FileText, Image as ImageIcon, Trash2, Download,
  DollarSign, User, Calendar, Loader2, MessageSquare, Paperclip, Clock,
} from 'lucide-react';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profile?: { full_name: string } | null;
}

interface Document {
  id: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  content_type: string;
  created_at: string;
  uploaded_by: string;
  uploader?: { full_name: string } | null;
}

interface ActivityLog {
  id: string;
  action: string;
  details: string;
  created_at: string;
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
  deal_number: number;
  created_at: string;
  client_id: string;
  assigned_to: string | null;
  profiles?: { full_name: string } | null;
  assigned_profile?: { full_name: string } | null;
}

interface DealDetailDialogProps {
  deal: Deal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDealUpdated: () => void;
}

const STAGES = ['Inception', 'Discovery', 'Proposal', 'Negotiation', 'Implementation', 'Completion'];

const stageColors: Record<string, string> = {
  Inception: 'bg-muted text-muted-foreground',
  Discovery: 'bg-primary/10 text-primary',
  Proposal: 'bg-accent/10 text-accent-foreground',
  Negotiation: 'bg-warning/10 text-warning-foreground',
  Implementation: 'bg-primary/20 text-primary',
  Completion: 'bg-success/10 text-success-foreground',
};

export default function DealDetailDialog({ deal, open, onOpenChange, onDealUpdated }: DealDetailDialogProps) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [newComment, setNewComment] = useState('');
  const [valueEdit, setValueEdit] = useState('');
  const [costEdit, setCostEdit] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);

  useEffect(() => {
    if (deal && open) {
      setValueEdit(String(deal.value || 0));
      setCostEdit(String(deal.cost || 0));
      fetchComments();
      fetchDocuments();
      fetchActivityLogs();
    }
  }, [deal?.id, open]);

  const fetchComments = async () => {
    if (!deal) return;
    setLoadingComments(true);
    const { data } = await supabase
      .from('comments')
      .select('*, profile:profiles!comments_user_id_fkey(full_name)')
      .eq('deal_id', deal.id)
      .order('created_at', { ascending: true });
    setComments((data as any) || []);
    setLoadingComments(false);
  };

  const fetchDocuments = async () => {
    if (!deal) return;
    setLoadingDocs(true);
    const { data } = await supabase
      .from('documents')
      .select('*, uploader:profiles!documents_uploaded_by_fkey(full_name)')
      .eq('deal_id', deal.id)
      .order('created_at', { ascending: false });
    setDocuments((data as any) || []);
    setLoadingDocs(false);
  };

  const fetchActivityLogs = async () => {
    if (!deal) return;
    const { data } = await supabase
      .from('activity_logs')
      .select('*, profile:profiles!activity_logs_user_id_fkey(full_name)')
      .eq('deal_id', deal.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setActivityLogs((data as any) || []);
  };

  const handleComment = async () => {
    if (!deal || !user || !newComment.trim()) return;
    const { error } = await supabase.from('comments').insert({
      deal_id: deal.id, user_id: user.id, content: newComment.trim(),
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setNewComment('');
      fetchComments();
    }
  };

  const handleSaveFinancials = async () => {
    if (!deal) return;
    const { error } = await supabase.from('deals').update({
      value: parseFloat(valueEdit) || 0,
      cost: parseFloat(costEdit) || 0,
    }).eq('id', deal.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Financials updated' });
      onDealUpdated();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!deal || !user || !e.target.files?.length) return;
    setUploading(true);
    const file = e.target.files[0];
    const path = `${deal.id}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file);
    if (uploadError) {
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    const { error: dbError } = await supabase.from('documents').insert({
      deal_id: deal.id,
      uploaded_by: user.id,
      file_name: file.name,
      storage_path: path,
      file_size: file.size,
      content_type: file.type,
    });

    if (dbError) {
      toast({ title: 'Error', description: dbError.message, variant: 'destructive' });
    } else {
      toast({ title: 'Document uploaded' });
      fetchDocuments();
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = async (doc: Document) => {
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const handleDeleteDoc = async (doc: Document) => {
    await supabase.storage.from('documents').remove([doc.storage_path]);
    await supabase.from('documents').delete().eq('id', doc.id);
    fetchDocuments();
    toast({ title: 'Document removed' });
  };

  if (!deal) return null;

  const stageIndex = STAGES.indexOf(deal.status);
  const profit = (parseFloat(valueEdit) || 0) - (parseFloat(costEdit) || 0);
  const canEditFinancials = role === 'staff' || role === 'admin';

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (contentType: string) => {
    if (contentType?.startsWith('image/')) return <ImageIcon className="h-4 w-4 text-accent" />;
    return <FileText className="h-4 w-4 text-primary" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-mono text-primary/70 mb-1">TD-{1000 + (deal.deal_number || 0)}</p>
              <DialogTitle className="text-xl font-display">{deal.title}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{deal.service_type || 'Unspecified service'}</p>
            </div>
            <Badge className={`${stageColors[deal.status]} shrink-0`}>{deal.status}</Badge>
          </div>
        </DialogHeader>

        {/* Progress bar */}
        <div className="flex items-center gap-1 mt-2">
          {STAGES.map((stage, i) => (
            <div key={stage} className="flex-1 group relative">
              <div className={`h-2 rounded-full transition-colors ${i <= stageIndex ? 'gradient-primary' : 'bg-muted'}`} />
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{stage}</span>
            </div>
          ))}
        </div>

        {/* Key info row */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <div className="rounded-lg border border-border p-3 text-center">
            <User className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Client</p>
            <p className="text-sm font-medium text-foreground truncate">{deal.profiles?.full_name || '—'}</p>
          </div>
          <div className="rounded-lg border border-border p-3 text-center">
            <User className="h-4 w-4 mx-auto text-primary mb-1" />
            <p className="text-xs text-muted-foreground">Assigned To</p>
            <p className="text-sm font-medium text-foreground truncate">{deal.assigned_profile?.full_name || 'Unassigned'}</p>
          </div>
          <div className="rounded-lg border border-border p-3 text-center">
            <Calendar className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="text-sm font-medium text-foreground">{new Date(deal.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        {deal.description && (
          <div className="mt-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Description</p>
            <p className="text-sm text-foreground leading-relaxed">{deal.description}</p>
          </div>
        )}

        <Separator />

        <Tabs defaultValue="financials" className="w-full">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="financials" className="text-xs">
              <DollarSign className="h-3 w-3 mr-1" />Financials
            </TabsTrigger>
            <TabsTrigger value="comments" className="text-xs">
              <MessageSquare className="h-3 w-3 mr-1" />Comments {comments.length > 0 && `(${comments.length})`}
            </TabsTrigger>
            <TabsTrigger value="documents" className="text-xs">
              <Paperclip className="h-3 w-3 mr-1" />Documents {documents.length > 0 && `(${documents.length})`}
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />Activity
            </TabsTrigger>
          </TabsList>

          {/* Financials */}
          <TabsContent value="financials" className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Deal Value ($)</Label>
                <Input
                  type="number" value={valueEdit}
                  onChange={(e) => setValueEdit(e.target.value)}
                  disabled={!canEditFinancials}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cost ($)</Label>
                <Input
                  type="number" value={costEdit}
                  onChange={(e) => setCostEdit(e.target.value)}
                  disabled={!canEditFinancials}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Profit</Label>
                <div className={`h-10 flex items-center px-3 rounded-md border border-input font-mono text-sm ${profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                  ${profit.toLocaleString()}
                </div>
              </div>
            </div>
            {canEditFinancials && (
              <Button size="sm" onClick={handleSaveFinancials} className="gradient-primary text-primary-foreground">
                Save Financials
              </Button>
            )}
          </TabsContent>

          {/* Comments */}
          <TabsContent value="comments" className="mt-4">
            {loadingComments ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-3 max-h-[250px] overflow-y-auto">
                {comments.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No comments yet. Start the conversation.</p>
                )}
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <div className="h-7 w-7 rounded-full gradient-primary flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-primary-foreground">
                        {c.profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="flex-1 bg-muted/40 rounded-lg p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">{c.profile?.full_name || 'User'}</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-foreground mt-0.5">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-3">
              <Input
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleComment()}
                className="text-sm"
              />
              <Button size="icon" className="shrink-0 gradient-primary text-primary-foreground" onClick={handleComment} disabled={!newComment.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          {/* Documents */}
          <TabsContent value="documents" className="mt-4">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx"
              onChange={handleFileUpload}
            />
            <Button
              variant="outline" size="sm" className="w-full mb-3 border-dashed"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {uploading ? 'Uploading...' : 'Upload Document'}
            </Button>

            {loadingDocs ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : documents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No documents attached to this deal.</p>
            ) : (
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                    {getFileIcon(doc.content_type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{doc.file_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatFileSize(doc.file_size)} • {doc.uploader?.full_name || 'Unknown'} • {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleDownload(doc)}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    {(role === 'admin' || doc.uploaded_by === user?.id) && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteDoc(doc)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Activity */}
          <TabsContent value="activity" className="mt-4">
            {activityLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No activity recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {activityLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    <div>
                      <p className="text-foreground">
                        <span className="font-medium">{log.profile?.full_name || 'System'}</span>
                        {' — '}{log.details}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { RoleBadge } from '@/components/RoleBadge';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useCurrency } from '@/hooks/useCurrency';
import DocumentLightbox from '@/components/DocumentLightbox';
import { compressImage } from '@/lib/imageCompression';
import { motion, AnimatePresence } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Send, Upload, FileText, Image as ImageIcon, Trash2, Download,
  DollarSign, User, Calendar, Loader2, MessageSquare, Paperclip, Clock, ShieldAlert, Eye, AtSign,
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
  user_id: string | null;
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

const actionLabels: Record<string, string> = {
  status_change: '📋 Stage update',
  claimed: '🤝 Deal claimed',
  note: '📝 Quick note',
  project_created: '🆕 Project created',
  document_upload: '📎 File upload',
  comment_added: '💬 Comment added',
  financial_update: '💰 Financial update',
  deal_updated: '✏️ Deal updated',
};

const formatActivityText = (log: ActivityLog) => {
  const details = (log.details || '').trim();
  if (!details || /deal was modified/i.test(details)) {
    return actionLabels[log.action] || log.action.replace(/_/g, ' ');
  }
  return details;
};

function groupActivityLogs(logs: ActivityLog[]) {
  const groups: { key: string; logs: ActivityLog[]; summary: string; user: string; userId: string | null; time: string }[] = [];
  for (const log of logs) {
    const lastGroup = groups[groups.length - 1];
    if (
      lastGroup &&
      lastGroup.logs[0].user_id === log.user_id &&
      lastGroup.logs[0].action === log.action &&
      Math.abs(new Date(lastGroup.logs[0].created_at).getTime() - new Date(log.created_at).getTime()) < 5 * 60 * 1000
    ) {
      lastGroup.logs.push(log);
      const count = lastGroup.logs.length;
      const userName = log.profile?.full_name || 'System';
      const activityLabel = (actionLabels[log.action] || log.action.replace(/_/g, ' ')).replace(/^[^\w]+\s*/, '').toLowerCase();
      lastGroup.summary = `${userName} performed ${count} ${activityLabel}${count > 1 ? 's' : ''}`;
    } else {
      groups.push({
        key: log.id,
        logs: [log],
        summary: '',
        user: log.profile?.full_name || 'System',
        userId: log.user_id,
        time: log.created_at,
      });
    }
  }
  return groups;
}

export default function DealDetailDialog({ deal, open, onOpenChange, onDealUpdated }: DealDetailDialogProps) {
  const { user, role, profile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const roleMap = useUserRoles();
  const { formatCurrency, currencyLabel } = useCurrency();

  const [comments, setComments] = useState<Comment[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [newComment, setNewComment] = useState('');
  const [valueEdit, setValueEdit] = useState('');
  const [costEdit, setCostEdit] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [commentReads, setCommentReads] = useState<Record<string, string[]>>({});
  const [lightboxDoc, setLightboxDoc] = useState<{ url: string; fileName: string; contentType: string } | null>(null);
  const [allProfiles, setAllProfiles] = useState<{ id: string; full_name: string }[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const commentInputRef = useRef<HTMLInputElement>(null);
  const [taxPresets, setTaxPresets] = useState<{ id: string; region_name: string; country_code: string; taxes: { name: string; rate: number }[] }[]>([]);
  const [selectedTaxPreset, setSelectedTaxPreset] = useState<string>('');

  const frozenActions = profile?.frozen_actions || [];
  const canComment = !frozenActions.includes('comment');
  const canUpload = !frozenActions.includes('upload');

  useEffect(() => {
    if (deal && open) {
      setValueEdit(String(deal.value || 0));
      setCostEdit(String(deal.cost || 0));
      fetchComments();
      fetchDocuments();
      fetchActivityLogs();
      fetchProfiles();
      fetchTaxPresets();
    }
  }, [deal?.id, open]);

  const fetchTaxPresets = async () => {
    const { data } = await supabase.from('tax_presets').select('*').order('is_default', { ascending: false });
    const presets = (data as any) || [];
    setTaxPresets(presets.map((p: any) => ({ ...p, taxes: typeof p.taxes === 'string' ? JSON.parse(p.taxes) : p.taxes })));
    const defaultPreset = presets.find((p: any) => p.is_default);
    if (defaultPreset && !selectedTaxPreset) setSelectedTaxPreset(defaultPreset.id);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name');
    setAllProfiles((data as any) || []);
  };

  const fetchCommentReads = useCallback(async (commentIds: string[]) => {
    if (!commentIds.length) return;
    const { data } = await supabase
      .from('comment_reads')
      .select('comment_id, user_id')
      .in('comment_id', commentIds);
    const reads: Record<string, string[]> = {};
    (data || []).forEach((r: any) => {
      if (!reads[r.comment_id]) reads[r.comment_id] = [];
      reads[r.comment_id].push(r.user_id);
    });
    setCommentReads(reads);
  }, []);

  const markCommentsAsRead = useCallback(async (commentIds: string[]) => {
    if (!user || !commentIds.length) return;
    const unread = commentIds.filter(id => !(commentReads[id] || []).includes(user.id));
    if (!unread.length) return;
    await Promise.all(unread.map(id =>
      supabase.from('comment_reads').upsert({ comment_id: id, user_id: user.id }, { onConflict: 'comment_id,user_id' })
    ));
    fetchCommentReads(commentIds);
  }, [user, commentReads, fetchCommentReads]);

  const fetchComments = async () => {
    if (!deal) return;
    setLoadingComments(true);
    const { data, error } = await supabase
      .from('comments')
      .select('*, profile:profiles!comments_user_id_fkey(full_name)')
      .eq('deal_id', deal.id)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Comments fetch error:', error);
      setComments([]);
    } else {
      const commentsData = (data as any) || [];
      setComments(commentsData);
      fetchCommentReads(commentsData.map((c: any) => c.id));
      // Auto-mark as read when viewing
      if (user) {
        const ids = commentsData.filter((c: any) => c.user_id !== user.id).map((c: any) => c.id);
        if (ids.length) setTimeout(() => markCommentsAsRead(ids), 500);
      }
    }
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
      .limit(30);
    setActivityLogs((data as any) || []);
  };

  const handleComment = async () => {
    if (!deal || !user || !newComment.trim()) return;
    if (!canComment) {
      toast({ title: 'Action restricted', description: 'Your commenting privileges have been suspended by an admin.', variant: 'destructive' });
      return;
    }
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

  const handleDeleteComment = async (commentId: string) => {
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Comment deleted' });
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
    if (!canUpload) {
      toast({ title: 'Action restricted', description: 'Your upload privileges have been suspended by an admin.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    let file = e.target.files[0];
    
    // Auto-compress images before upload
    if (file.type.startsWith('image/')) {
      const originalSize = file.size;
      file = await compressImage(file, 1920, 0.8);
      if (file.size < originalSize) {
        toast({ title: 'Image optimized', description: `Compressed from ${(originalSize / 1024 / 1024).toFixed(1)}MB to ${(file.size / 1024 / 1024).toFixed(1)}MB` });
      }
    }

    const path = `${deal.id}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file);
    if (uploadError) {
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    const { error: dbError } = await supabase.from('documents').insert({
      deal_id: deal.id, uploaded_by: user.id, file_name: file.name,
      storage_path: path, file_size: file.size, content_type: file.type,
    });

    if (dbError) {
      toast({ title: 'Error', description: dbError.message, variant: 'destructive' });
    } else {
      toast({ title: 'Document uploaded' });
      fetchDocuments();
      await supabase.from('activity_logs').insert({
        deal_id: deal.id, user_id: user.id, action: 'document_upload',
        details: `Uploaded "${file.name}"`,
      });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = async (doc: Document) => {
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const handlePreview = async (doc: Document) => {
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 300);
    if (data?.signedUrl) {
      setLightboxDoc({ url: data.signedUrl, fileName: doc.file_name, contentType: doc.content_type });
    }
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

  const activityGroups = groupActivityLogs(activityLogs);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:max-w-2xl w-[95vw]">
        <DialogHeader className="pb-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div>
              <p className="text-xs font-mono text-primary/70 mb-1">TD-{1000 + (deal.deal_number || 0)}</p>
              <DialogTitle className="text-lg sm:text-xl font-display">{deal.title}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{deal.service_type || 'Unspecified service'}</p>
            </div>
            <Badge className={`${stageColors[deal.status]} shrink-0 self-start`}>{deal.status}</Badge>
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
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-6">
          <div className="rounded-lg border border-border p-2 sm:p-3 text-center">
            <User className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-[10px] text-muted-foreground">Client</p>
            <p className="text-xs sm:text-sm font-medium text-foreground truncate">{deal.profiles?.full_name || '—'}</p>
            <div className="mt-1"><RoleBadge role="client" /></div>
          </div>
          <div className="rounded-lg border border-border p-2 sm:p-3 text-center">
            <User className="h-4 w-4 mx-auto text-primary mb-1" />
            <p className="text-[10px] text-muted-foreground">Assigned To</p>
            <p className="text-xs sm:text-sm font-medium text-foreground truncate">{deal.assigned_profile?.full_name || 'Unassigned'}</p>
            {deal.assigned_to && roleMap[deal.assigned_to] && (
              <div className="mt-1"><RoleBadge role={roleMap[deal.assigned_to]} /></div>
            )}
          </div>
          <div className="rounded-lg border border-border p-2 sm:p-3 text-center">
            <Calendar className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-[10px] text-muted-foreground">Created</p>
            <p className="text-xs sm:text-sm font-medium text-foreground">{new Date(deal.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        {deal.description && (
          <div className="mt-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Description</p>
            <p className="text-sm text-foreground leading-relaxed">{deal.description}</p>
          </div>
        )}

        <Separator />

        <Tabs defaultValue="comments" className="w-full">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="financials" className="text-[10px] sm:text-xs">
              <DollarSign className="h-3 w-3 mr-0.5 sm:mr-1" /><span className="hidden sm:inline">Financials</span><span className="sm:hidden">{currencyLabel}</span>
            </TabsTrigger>
            <TabsTrigger value="comments" className="text-[10px] sm:text-xs">
              <MessageSquare className="h-3 w-3 mr-0.5 sm:mr-1" />
              <span className="hidden sm:inline">Comments</span><span className="sm:hidden">Chat</span>
              {comments.length > 0 && <span className="ml-0.5">({comments.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="documents" className="text-[10px] sm:text-xs">
              <Paperclip className="h-3 w-3 mr-0.5 sm:mr-1" />
              <span className="hidden sm:inline">Docs</span><span className="sm:hidden">Files</span>
              {documents.length > 0 && <span className="ml-0.5">({documents.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-[10px] sm:text-xs">
              <Clock className="h-3 w-3 mr-0.5 sm:mr-1" /><span className="hidden sm:inline">Activity</span><span className="sm:hidden">Log</span>
            </TabsTrigger>
          </TabsList>

          {/* Financials */}
          <TabsContent value="financials" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Deal Value ({currencyLabel})</Label>
                <Input type="number" value={valueEdit} onChange={(e) => setValueEdit(e.target.value)} disabled={!canEditFinancials} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cost ({currencyLabel})</Label>
                <Input type="number" value={costEdit} onChange={(e) => setCostEdit(e.target.value)} disabled={!canEditFinancials} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Profit (before tax)</Label>
                <div className={`h-10 flex items-center px-3 rounded-md border border-input font-mono text-sm ${profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(profit)}
                </div>
              </div>
            </div>
            {canEditFinancials && (
              <Button size="sm" onClick={handleSaveFinancials} className="gradient-primary text-primary-foreground">Save Financials</Button>
            )}

            {/* Tax Compliance Calculator */}
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tax Compliance Calculator</Label>
                <Select value={selectedTaxPreset} onValueChange={setSelectedTaxPreset}>
                  <SelectTrigger className="h-7 w-[160px] text-xs">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {taxPresets.map(tp => (
                      <SelectItem key={tp.id} value={tp.id}>
                        <span className="flex items-center gap-1.5">{tp.country_code} — {tp.region_name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(() => {
                const preset = taxPresets.find(tp => tp.id === selectedTaxPreset);
                if (!preset) return <p className="text-xs text-muted-foreground">Select a tax region above</p>;
                const dealValue = parseFloat(valueEdit) || 0;
                let totalTaxRate = 0;
                const taxLines = preset.taxes.map(t => {
                  totalTaxRate += t.rate;
                  const amount = dealValue * (t.rate / 100);
                  return { ...t, amount };
                });
                const totalTax = dealValue * (totalTaxRate / 100);
                const netProfit = profit - totalTax;
                return (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                    {taxLines.map((t, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{t.name} ({t.rate}%)</span>
                        <span className="font-mono text-foreground">{formatCurrency(t.amount)}</span>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-muted-foreground">Total Tax ({totalTaxRate}%)</span>
                      <span className="font-mono text-destructive">{formatCurrency(totalTax)}</span>
                    </div>
                    <div className={`flex items-center justify-between text-sm font-bold pt-1`}>
                      <span className="text-foreground">Net Profit (after tax)</span>
                      <span className={`font-mono ${netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(netProfit)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </TabsContent>

          {/* Comments */}
          <TabsContent value="comments" className="mt-4">
            {loadingComments ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {comments.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No comments yet. Start the conversation.</p>
                )}
                {comments.map((c) => {
                  const commentRole = roleMap[c.user_id];
                  const readers = (commentReads[c.id] || []).filter(uid => uid !== c.user_id);
                  const readerNames = readers.map(uid => allProfiles.find(p => p.id === uid)?.full_name || 'User').slice(0, 3);
                  
                  // Render @mentions in bold
                  const renderContent = (text: string) => {
                    const parts = text.split(/(@\w[\w\s]*)/g);
                    return parts.map((part, i) =>
                      part.startsWith('@') ? <span key={i} className="font-semibold text-primary">{part}</span> : part
                    );
                  };
                  
                  return (
                    <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 group">
                      <div className="h-7 w-7 rounded-full gradient-primary flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-primary-foreground">
                          {c.profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1 bg-muted/40 rounded-lg p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-foreground">{c.profile?.full_name || 'User'}</span>
                            {commentRole && <RoleBadge role={commentRole} />}
                            <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {readers.length > 0 && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="text-[9px] text-muted-foreground flex items-center gap-0.5 hover:text-primary transition-colors cursor-pointer">
                                    <Eye className="h-3 w-3" />
                                    {readers.length}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-48 p-2" side="left" align="start">
                                  <p className="text-xs font-semibold text-foreground mb-1.5">Seen by</p>
                                  <div className="space-y-1">
                                    {readers.map(uid => {
                                      const p = allProfiles.find(pr => pr.id === uid);
                                      const rRole = roleMap[uid];
                                      return (
                                        <div key={uid} className="flex items-center gap-2 text-xs">
                                          <div className="h-5 w-5 rounded-full gradient-primary flex items-center justify-center shrink-0">
                                            <span className="text-[8px] font-bold text-primary-foreground">{p?.full_name?.charAt(0)?.toUpperCase() || '?'}</span>
                                          </div>
                                          <span className="text-foreground truncate">{p?.full_name || 'User'}</span>
                                          {rRole && <RoleBadge role={rRole} />}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                            {(role === 'admin' || c.user_id === user?.id) && (
                              <Button
                                variant="ghost" size="icon"
                                className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                                onClick={() => handleDeleteComment(c.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-foreground mt-0.5">{renderContent(c.content)}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
            {!canComment && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-2 mt-3">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                Your commenting privileges have been suspended.
              </div>
            )}
            <div className="relative mt-3">
              {showMentions && (
                <div className="absolute bottom-full mb-1 left-0 right-0 z-50 bg-card border border-border rounded-lg shadow-elevated max-h-[150px] overflow-y-auto">
                  {allProfiles
                    .filter(p => p.full_name?.toLowerCase().includes(mentionQuery.toLowerCase()))
                    .slice(0, 5)
                    .map(p => (
                      <button
                        key={p.id}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 flex items-center gap-2"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const before = newComment.substring(0, newComment.lastIndexOf('@'));
                          setNewComment(`${before}@${p.full_name} `);
                          setShowMentions(false);
                        }}
                      >
                        <AtSign className="h-3 w-3 text-primary" />
                        <span className="text-foreground">{p.full_name}</span>
                        {roleMap[p.id] && <RoleBadge role={roleMap[p.id]} />}
                      </button>
                    ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  ref={commentInputRef}
                  placeholder={canComment ? 'Write a comment... (type @ to mention)' : 'Commenting disabled'}
                  value={newComment}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewComment(val);
                    const lastAt = val.lastIndexOf('@');
                    if (lastAt >= 0 && !val.substring(lastAt).includes(' ')) {
                      setShowMentions(true);
                      setMentionQuery(val.substring(lastAt + 1));
                    } else {
                      setShowMentions(false);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !showMentions) handleComment();
                    if (e.key === 'Escape') setShowMentions(false);
                  }}
                  onBlur={() => setTimeout(() => setShowMentions(false), 200)}
                  className="text-sm"
                  disabled={!canComment}
                />
                <Button size="icon" className="shrink-0 gradient-primary text-primary-foreground" onClick={handleComment} disabled={!newComment.trim() || !canComment}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Documents */}
          <TabsContent value="documents" className="mt-4">
            <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx" onChange={handleFileUpload} />
            {!canUpload && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-2 mb-3">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                Your upload privileges have been suspended.
              </div>
            )}
            <Button variant="outline" size="sm" className="w-full mb-3 border-dashed" onClick={() => fileInputRef.current?.click()} disabled={uploading || !canUpload}>
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {uploading ? 'Uploading...' : 'Upload Document'}
            </Button>

            {loadingDocs ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : documents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No documents attached to this deal.</p>
            ) : (
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {documents.map((doc) => {
                  const uploaderRole = roleMap[doc.uploaded_by];
                  return (
                    <div key={doc.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => handlePreview(doc)}>
                      {getFileIcon(doc.content_type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{doc.file_name}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 flex-wrap">
                          {formatFileSize(doc.file_size)} •
                          <span className="inline-flex items-center gap-1">
                            {doc.uploader?.full_name || 'Unknown'}
                            {uploaderRole && <RoleBadge role={uploaderRole} />}
                          </span>
                          • {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => { e.stopPropagation(); handlePreview(doc); }} title="Preview">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      {(role === 'admin' || doc.uploaded_by === user?.id) && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Activity with Story Grouping */}
          <TabsContent value="activity" className="mt-4">
            {activityGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No activity recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {activityGroups.map((group) => (
                  <div key={group.key}>
                    {group.logs.length === 1 ? (
                      <div className="flex items-start gap-2 text-sm">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
                        <div className="flex-1">
                          <p className="text-foreground flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium">{group.user}</span>
                            {group.userId && roleMap[group.userId] && <RoleBadge role={roleMap[group.userId]} />}
                            <Badge variant="secondary" className="text-[10px]">{actionLabels[group.logs[0].action] || group.logs[0].action.replace(/_/g, ' ')}</Badge>
                          </p>
                          <p className="text-xs text-muted-foreground">{formatActivityText(group.logs[0])}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(group.time).toLocaleString()}</p>
                        </div>
                        {group.userId === user?.id && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={async () => {
                            await supabase.from('activity_logs').delete().eq('id', group.logs[0].id);
                            fetchActivityLogs();
                            toast({ title: 'Activity deleted' });
                          }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="border border-border rounded-lg p-2">
                        <button
                          className="flex items-center gap-2 text-sm w-full text-left"
                          onClick={() => setExpandedGroup(expandedGroup === group.key ? null : group.key)}
                        >
                          <div className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                          <span className="font-medium text-foreground flex items-center gap-1.5 flex-wrap">
                            {group.summary}
                            {group.userId && roleMap[group.userId] && <RoleBadge role={roleMap[group.userId]} />}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-auto">{new Date(group.time).toLocaleString()}</span>
                          <span className="text-muted-foreground text-xs">{expandedGroup === group.key ? '▲' : '▼'}</span>
                        </button>
                        {expandedGroup === group.key && (
                          <div className="mt-2 pl-4 space-y-1 border-l-2 border-border ml-1">
                            {group.logs.map((log) => (
                              <div key={log.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                                <span className="flex-1"><span>{actionLabels[log.action] || log.action.replace(/_/g, ' ')}: {formatActivityText(log)}</span>
                                <span className="ml-2 text-[10px]">{new Date(log.created_at).toLocaleString()}</span></span>
                                {log.user_id === user?.id && (
                                  <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive" onClick={async () => {
                                    await supabase.from('activity_logs').delete().eq('id', log.id);
                                    fetchActivityLogs();
                                    toast({ title: 'Activity deleted' });
                                  }}>
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
      {lightboxDoc && (
        <DocumentLightbox
          open={!!lightboxDoc}
          onOpenChange={(open) => !open && setLightboxDoc(null)}
          url={lightboxDoc.url}
          fileName={lightboxDoc.fileName}
          contentType={lightboxDoc.contentType}
        />
      )}
    </Dialog>
  );
}

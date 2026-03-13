import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Paperclip, FileText, Download, Loader2, Info, Trash2, Check, CheckCheck, Eye } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { toast } from 'sonner';
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  read_by: string[];
}

interface Participant {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  avatar_position: string;
}

interface ConversationMeta {
  id: string;
  title: string;
  description: string | null;
}

interface ChatViewProps {
  conversationId: string;
}

export function ChatView({ conversationId }: ChatViewProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [convo, setConvo] = useState<ConversationMeta | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 50);
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const [{ data: convoData }, { data: msgs }, { data: parts }] = await Promise.all([
      supabase.from('conversations').select('id, title, description').eq('id', conversationId).single(),
      supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true }),
      supabase.from('conversation_participants').select('user_id').eq('conversation_id', conversationId),
    ]);

    setConvo(convoData as ConversationMeta | null);
    setMessages((msgs as Message[]) || []);

    const userIds = (parts || []).map((p: any) => p.user_id);
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, avatar_position')
        .in('id', userIds);
      setParticipants((profiles || []).map((p: any) => ({
        user_id: p.id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        avatar_position: p.avatar_position,
      })));
    }

    // Mark as read
    if (user) {
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      // Mark all messages as read by this user
      const unreadMsgs = (msgs || []).filter(
        (m: any) => m.sender_id !== user.id && !(m.read_by || []).includes(user.id)
      );
      for (const m of unreadMsgs) {
        await supabase
          .from('messages')
          .update({ read_by: [...(m.read_by || []), user.id] } as any)
          .eq('id', m.id);
      }
    }

    setLoading(false);
    scrollToBottom();
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const newMsg = payload.new as Message;
        setMessages(prev => [...prev, newMsg]);
        scrollToBottom();
        // Mark as read immediately if we're viewing
        if (user && newMsg.sender_id !== user.id) {
          supabase
            .from('conversation_participants')
            .update({ last_read_at: new Date().toISOString() })
            .eq('conversation_id', conversationId)
            .eq('user_id', user.id);
          // Add to read_by
          supabase
            .from('messages')
            .update({ read_by: [...(newMsg.read_by || []), user.id] } as any)
            .eq('id', newMsg.id);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } as Message : m));
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== (payload.old as any).id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  const getParticipant = (userId: string) =>
    participants.find(p => p.user_id === userId);

  const sendMessage = async () => {
    if (!input.trim() || !user || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);

    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: text,
    } as any);

    if (error) toast.error('Failed to send message');
    setSending(false);
  };

  const handleDeleteMessage = async (messageId: string) => {
    const { error } = await supabase.from('messages').delete().eq('id', messageId);
    if (error) {
      toast.error('Failed to delete message');
    } else {
      setMessages(prev => prev.filter(m => m.id !== messageId));
      toast.success('Message deleted');
    }
    setDeleteTarget(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error('File must be under 20MB');
      return;
    }

    setUploading(true);
    const path = `${conversationId}/${Date.now()}_${file.name}`;

    const { error: uploadErr } = await supabase.storage
      .from('chat-attachments')
      .upload(path, file);

    if (uploadErr) {
      toast.error('Upload failed');
      setUploading(false);
      return;
    }

    const { data: signedData } = await supabase.storage
      .from('chat-attachments')
      .createSignedUrl(path, 60 * 60 * 24 * 365);

    const { data: urlData } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(path);

    const fileUrl = signedData?.signedUrl || urlData.publicUrl;

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: null,
      file_url: fileUrl,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
    } as any);

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatMsgTime = (dateStr: string) => format(new Date(dateStr), 'h:mm a');

  const formatDateSeparator = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMMM d, yyyy');
  };

  const isImage = (type: string | null) => type?.startsWith('image/');

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getReadStatus = (msg: Message): 'sent' | 'delivered' | 'seen' => {
    if (msg.sender_id !== user?.id) return 'sent';
    const otherParticipants = participants.filter(p => p.user_id !== user?.id);
    const readByOthers = (msg.read_by || []).filter(id => id !== user?.id);
    if (readByOthers.length > 0) return 'seen';
    return 'delivered';
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  messages.forEach(m => {
    const dateKey = format(new Date(m.created_at), 'yyyy-MM-dd');
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    if (lastGroup?.date === dateKey) {
      lastGroup.messages.push(m);
    } else {
      groupedMessages.push({ date: dateKey, messages: [m] });
    }
  });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Chat header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-card">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex -space-x-2">
            {participants.filter(p => p.user_id !== user?.id).slice(0, 3).map(p => (
              <UserAvatar
                key={p.user_id}
                fullName={p.full_name}
                avatarUrl={p.avatar_url}
                avatarPosition={p.avatar_position}
                className="h-8 w-8 border-2 border-card"
                fallbackClassName="text-[10px]"
              />
            ))}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">{convo?.title}</h3>
            <p className="text-[11px] text-muted-foreground truncate">
              {participants.filter(p => p.user_id !== user?.id).map(p => p.full_name || 'User').join(', ')}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={() => setShowInfo(!showInfo)}
        >
          <Info className="h-4 w-4" />
        </Button>
      </div>

      {showInfo && convo?.description && (
        <div className="px-4 py-2 bg-muted/50 border-b border-border">
          <p className="text-xs text-muted-foreground">{convo.description}</p>
        </div>
      )}

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {groupedMessages.map(group => (
          <div key={group.date}>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                {formatDateSeparator(group.messages[0].created_at)}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {group.messages.map((m, idx) => {
              const isMe = m.sender_id === user?.id;
              const sender = getParticipant(m.sender_id);
              const prevMsg = idx > 0 ? group.messages[idx - 1] : null;
              const showAvatar = !prevMsg || prevMsg.sender_id !== m.sender_id;
              const readStatus = getReadStatus(m);

              return (
                <ContextMenu key={m.id}>
                  <ContextMenuTrigger>
                    <div
                      className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''} ${showAvatar ? 'mt-3' : 'mt-0.5'}`}
                    >
                      <div className="w-8 shrink-0">
                        {showAvatar && !isMe && (
                          <UserAvatar
                            fullName={sender?.full_name}
                            avatarUrl={sender?.avatar_url}
                            avatarPosition={sender?.avatar_position}
                            className="h-8 w-8"
                            fallbackClassName="text-[10px]"
                          />
                        )}
                      </div>

                      <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                        {showAvatar && (
                          <span className={`text-[10px] font-medium mb-0.5 px-1 ${isMe ? 'text-right text-primary' : 'text-muted-foreground'}`}>
                            {isMe ? 'You' : sender?.full_name || 'User'}
                          </span>
                        )}

                        <div
                          className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                            isMe
                              ? 'bg-primary text-primary-foreground rounded-tr-md'
                              : 'bg-muted text-foreground rounded-tl-md'
                          }`}
                        >
                          {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}

                          {m.file_url && isImage(m.file_type) && (
                            <div className="mt-1">
                              <img
                                src={m.file_url}
                                alt={m.file_name || 'Image'}
                                className="rounded-lg max-w-full max-h-60 object-cover cursor-pointer"
                                onClick={() => window.open(m.file_url!, '_blank')}
                              />
                              {m.file_name && (
                                <p className={`text-[10px] mt-1 ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                  {m.file_name}
                                </p>
                              )}
                            </div>
                          )}

                          {m.file_url && !isImage(m.file_type) && (
                            <a
                              href={m.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center gap-2 p-2 rounded-lg mt-1 transition-colors ${
                                isMe ? 'bg-primary-foreground/10 hover:bg-primary-foreground/20' : 'bg-background hover:bg-background/80'
                              }`}
                            >
                              <FileText className={`h-8 w-8 shrink-0 ${isMe ? 'text-primary-foreground/80' : 'text-primary'}`} />
                              <div className="min-w-0 flex-1">
                                <p className={`text-xs font-medium truncate ${isMe ? 'text-primary-foreground' : 'text-foreground'}`}>
                                  {m.file_name}
                                </p>
                                <p className={`text-[10px] ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                                  {formatFileSize(m.file_size)}
                                </p>
                              </div>
                              <Download className={`h-4 w-4 shrink-0 ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`} />
                            </a>
                          )}
                        </div>

                        <div className={`flex items-center gap-1 mt-0.5 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                          <span className="text-[9px] text-muted-foreground/60">
                            {formatMsgTime(m.created_at)}
                          </span>
                          {isMe && (
                            <span className="flex items-center">
                              {readStatus === 'seen' ? (
                                <Eye className="h-3 w-3 text-primary" />
                              ) : (
                                <CheckCheck className="h-3 w-3 text-muted-foreground/50" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteTarget(m.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Delete for everyone
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        ))}

        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">No messages yet. Say hello! 👋</p>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </Button>
          <Input
            placeholder="Type a message..."
            className="flex-1 h-9 text-sm"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            disabled={sending}
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0 rounded-lg"
            onClick={sendMessage}
            disabled={!input.trim() || sending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Delete message confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this message for everyone in the conversation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDeleteMessage(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

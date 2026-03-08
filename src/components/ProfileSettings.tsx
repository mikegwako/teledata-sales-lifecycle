import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Camera, X } from 'lucide-react';

interface ProfileSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProfileSettings({ open, onOpenChange }: ProfileSettingsProps) {
  const { user, profile, role, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [autoDelete, setAutoDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarPosition, setAvatarPosition] = useState('center');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync form state when profile loads or dialog opens
  useEffect(() => {
    if (profile && open) {
      setFullName(profile.full_name || '');
      setPhoneNumber(profile.phone_number || '');
      setCurrency(profile.currency_preference || 'USD');
      setAutoDelete(!!profile.auto_delete_days);
      setAvatarPreview(profile.avatar_url || null);
      setAvatarPosition(profile.avatar_position || 'center');
    }
  }, [profile, open]);

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;
      
      // Delete old avatar if exists
      await supabase.storage.from('avatars').remove([`${user.id}/avatar.jpg`, `${user.id}/avatar.png`, `${user.id}/avatar.jpeg`, `${user.id}/avatar.webp`]);
      
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      await supabase.from('profiles').update({ avatar_url: avatarUrl } as any).eq('id', user.id);
      setAvatarPreview(avatarUrl);
      await refreshProfile();
      toast({ title: 'Profile photo updated' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    }
    setUploadingAvatar(false);
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    setUploadingAvatar(true);
    await supabase.storage.from('avatars').remove([`${user.id}/avatar.jpg`, `${user.id}/avatar.png`, `${user.id}/avatar.jpeg`, `${user.id}/avatar.webp`]);
    await supabase.from('profiles').update({ avatar_url: null } as any).eq('id', user.id);
    setAvatarPreview(null);
    await refreshProfile();
    toast({ title: 'Profile photo removed' });
    setUploadingAvatar(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      full_name: fullName,
      phone_number: phoneNumber,
      currency_preference: currency,
      auto_delete_days: autoDelete ? 40 : null,
      avatar_position: avatarPosition,
    } as any).eq('id', user.id);
    
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Profile updated' });
      await refreshProfile();
      onOpenChange(false);
    }
    setSaving(false);
  };

  const initials = (profile?.full_name?.charAt(0) || role?.charAt(0) || '?').toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Edit Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Avatar section */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              <Avatar className="h-20 w-20 border-2 border-border">
                {avatarPreview ? (
                  <AvatarImage src={avatarPreview} alt="Profile" />
                ) : null}
                <AvatarFallback className="text-lg font-bold gradient-primary text-primary-foreground">{initials}</AvatarFallback>
              </Avatar>
              <button
                className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAvatarUpload(file);
                  e.target.value = '';
                }}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar}>
                <Camera className="h-3 w-3 mr-1" />Upload Photo
              </Button>
              {avatarPreview && (
                <Button variant="outline" size="sm" className="text-xs text-destructive" onClick={handleRemoveAvatar} disabled={uploadingAvatar}>
                  <X className="h-3 w-3 mr-1" />Remove
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email || ''} disabled className="opacity-60" />
            <p className="text-[10px] text-muted-foreground">Email cannot be changed</p>
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Input value={role} disabled className="opacity-60 capitalize" />
            <p className="text-[10px] text-muted-foreground">Role is managed by admin</p>
          </div>
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
          </div>
          <div className="space-y-2">
            <Label>Phone Number</Label>
            <Input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+254 700 000 000" />
          </div>
          <div className="space-y-2">
            <Label>Currency Preference</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="KSH">KSH (KSh)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label className="text-sm">Auto-delete after 40 days</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">Automatically delete your notifications and activity logs older than 40 days</p>
            </div>
            <Switch checked={autoDelete} onCheckedChange={setAutoDelete} />
          </div>
          <Button className="w-full gradient-primary text-primary-foreground" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
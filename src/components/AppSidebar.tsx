import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { NavLink } from '@/components/NavLink';
import ProfileSettings from '@/components/ProfileSettings';
import teledataLogo from '@/assets/teledata-logo.jpeg';
import { supabase } from '@/lib/supabase';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { LayoutDashboard, KanbanSquare, FilePlus, FolderOpen, LogOut, ChevronLeft, FileBarChart, Settings, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AppSidebar() {
  const { role, profile, user, signOut } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);
      setUnreadCount(count || 0);
    };
    fetchUnread();
    const channel = supabase
      .channel('sidebar-notif-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => fetchUnread())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const navItems: { title: string; url: string; icon: any; badge?: number }[] = [];

  if (role === 'admin') {
    navItems.push(
      { title: 'Command Center', url: '/', icon: LayoutDashboard },
      { title: 'Deal Pipeline', url: '/pipeline', icon: KanbanSquare },
      { title: 'All Projects', url: '/projects', icon: FolderOpen },
      { title: 'Executive Report', url: '/report', icon: FileBarChart },
    );
  }

  if (role === 'staff') {
    navItems.push(
      { title: 'Deal Pipeline', url: '/pipeline', icon: KanbanSquare },
      { title: 'My Deals', url: '/projects', icon: FolderOpen },
    );
  }

  if (role === 'client') {
    navItems.push(
      { title: 'New Project', url: '/new-project', icon: FilePlus },
      { title: 'My Projects', url: '/projects', icon: FolderOpen },
    );
  }

  navItems.push({ title: 'Notifications', url: '/notifications', icon: Bell, badge: unreadCount });

  return (
    <>
      <Sidebar collapsible="icon" className="border-r-0">
        <SidebarContent className="bg-sidebar">
          <SidebarGroup>
            <div className="flex items-center gap-2 px-3 py-4">
              <img src={teledataLogo} alt="Teledata Africa" className="h-9 w-9 rounded-lg object-cover shrink-0" />
              {!collapsed && (
                <div className="animate-slide-in">
                  <h2 className="font-display font-bold text-sm text-sidebar-primary-foreground">Teledata Africa</h2>
                  <p className="text-xs text-sidebar-foreground/60">Sales Engine</p>
                </div>
              )}
              {!collapsed && (
                <Button variant="ghost" size="icon" className="ml-auto h-7 w-7 text-sidebar-foreground/60 hover:text-sidebar-foreground" onClick={toggleSidebar}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
            </div>

            <SidebarGroupLabel className="text-sidebar-foreground/40 text-xs uppercase tracking-wider">
              {!collapsed && 'Navigation'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === '/'}
                        className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="bg-sidebar border-t border-sidebar-border">
          <div className="flex items-center gap-2 px-3 py-3">
            <div className="h-8 w-8 rounded-full gradient-accent flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-accent-foreground">
                {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0 animate-slide-in">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.full_name || 'User'}</p>
                <p className="text-xs text-sidebar-foreground/50 capitalize">{role}</p>
              </div>
            )}
            {!collapsed && (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-sidebar-foreground/50 hover:text-sidebar-foreground" onClick={() => setSettingsOpen(true)}>
                  <Settings className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-sidebar-foreground/50 hover:text-destructive" onClick={signOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </SidebarFooter>
      </Sidebar>
      <ProfileSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

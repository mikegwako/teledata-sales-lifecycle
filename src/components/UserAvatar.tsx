import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface UserAvatarProps {
  fullName?: string | null;
  avatarUrl?: string | null;
  avatarPosition?: string;
  className?: string;
  fallbackClassName?: string;
}

export function UserAvatar({ fullName, avatarUrl, avatarPosition = 'center', className = 'h-7 w-7', fallbackClassName = 'text-[10px]' }: UserAvatarProps) {
  const initial = (fullName?.charAt(0) || '?').toUpperCase();

  return (
    <Avatar className={`${className} shrink-0`}>
      {avatarUrl ? (
        <AvatarImage src={avatarUrl} alt={fullName || 'User'} className="object-cover" style={{ objectPosition: avatarPosition }} />
      ) : null}
      <AvatarFallback className={`${fallbackClassName} font-bold gradient-primary text-primary-foreground`}>
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}

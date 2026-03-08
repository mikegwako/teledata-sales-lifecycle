import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type UserRoleMap = Record<string, string>;

export function useUserRoles() {
  const [roleMap, setRoleMap] = useState<UserRoleMap>({});

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('user_roles').select('user_id, role');
      if (data) {
        const map: UserRoleMap = {};
        data.forEach((r: any) => { map[r.user_id] = r.role; });
        setRoleMap(map);
      }
    };
    fetch();
  }, []);

  return roleMap;
}

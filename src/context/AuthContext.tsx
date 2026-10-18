import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  isTopAdmin: boolean;
  canManageAll: boolean;
  canManageAttendance: boolean;
  canManageMembers: boolean;
  canManageMaterials: boolean;
  canManageAssignments: boolean;
  isMemberOnly: boolean;
  isDivisionScoped: boolean;
  canViewReports: boolean;
  canViewDivisions: boolean;
  divisionIds: string[];
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      // 1. Fetch user profile and role
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          id, email, full_name, role_id, is_active, created_at,
          role:roles (id, name, description)
        `)
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        console.error('Error fetching user profile:', userError);
        return null;
      }

      // 2. Fetch member divisions
      const { data: divData } = await supabase
        .from('member_divisions')
        .select(`
          id, member_id, division_id, classification, is_active,
          division:divisions (id, name, code, description, is_active)
        `)
        .eq('member_id', userId)
        .eq('is_active', true);

      // Handle role object typing
      const rawRole = userData.role as any;
      const roleObj = Array.isArray(rawRole) ? rawRole[0] : rawRole;

      const fullProfile: UserProfile = {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        role_id: userData.role_id,
        is_active: userData.is_active,
        created_at: userData.created_at,
        role: roleObj ? {
          id: roleObj.id,
          name: roleObj.name as UserRole,
          description: roleObj.description
        } : undefined,
        divisions: (divData as any) || []
      };

      return fullProfile;
    } catch (err) {
      console.error('Profile fetch exception:', err);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    const p = await fetchProfile(user.id);
    setProfile(p);
  };

  useEffect(() => {
    let mounted = true;

    // Get current session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        const p = await fetchProfile(session.user.id);
        if (mounted) setProfile(p);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        if (session?.user) {
          setUser(session.user);
          const p = await fetchProfile(session.user.id);
          if (mounted) setProfile(p);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        setUser(data.user);
        const p = await fetchProfile(data.user.id);
        setProfile(p);
        return { success: true };
      }

      return { success: false, error: 'Pengguna tidak ditemukan.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal masuk sistem.' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const role = profile?.role?.name || null;
  const isTopAdmin = role === 'Pembina' || role === 'Ketua';
  const canManageAll = isTopAdmin;
  const canManageAttendance = isTopAdmin || role === 'Wakil Ketua' || role === 'Sekretaris' || role === 'Ketua Divisi' || role === 'Mentor';
  const canManageMembers = isTopAdmin || role === 'Wakil Ketua' || role === 'Sekretaris';
  const canManageMaterials = isTopAdmin || role === 'Wakil Ketua' || role === 'Sekretaris' || role === 'Ketua Divisi' || role === 'Mentor';
  const canManageAssignments = isTopAdmin || role === 'Ketua Divisi' || role === 'Mentor';
  const isMemberOnly = role === 'Member';
  // Petugas yang datanya terkunci pada divisinya sendiri (Ketua Divisi / Mentor)
  const isDivisionScoped = role === 'Ketua Divisi' || role === 'Mentor';
  // Pulang kebijakan: Laporan & Divisi hanya untuk Pembina, Ketua, Wakil, Sekre
  const canViewReports = isTopAdmin || role === 'Wakil Ketua' || role === 'Sekretaris';
  const canViewDivisions = canViewReports;

  const divisionIds = (profile?.divisions || []).map((d) => d.division_id);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        loading,
        isTopAdmin,
        canManageAll,
        canManageAttendance,
        canManageMembers,
        canManageMaterials,
        canManageAssignments,
        isMemberOnly,
        isDivisionScoped,
        canViewReports,
        canViewDivisions,
        divisionIds,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

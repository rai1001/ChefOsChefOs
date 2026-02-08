import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Hotel {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HotelMember {
  id: string;
  hotel_id: string;
  user_id: string;
  is_owner: boolean;
  created_at: string;
  profile?: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  roles?: string[];
}

export interface Invitation {
  id: string;
  hotel_id: string;
  email: string;
  role: 'admin' | 'jefe_cocina' | 'maitre' | 'produccion' | 'rrhh';
  token: string;
  expires_at: string;
  invited_by: string | null;
  accepted_at: string | null;
  created_at: string;
}

export function useHotel() {
  const { user, profile, refreshUserData } = useAuth();
  const queryClient = useQueryClient();

  // Get current hotel
  const { data: currentHotel, isLoading: hotelLoading } = useQuery({
    queryKey: ['current-hotel', profile?.current_hotel_id],
    queryFn: async () => {
      if (!profile?.current_hotel_id) return null;
      
      const { data, error } = await supabase
        .from('hotels')
        .select('*')
        .eq('id', profile.current_hotel_id)
        .single();
      
      if (error) throw error;
      return data as Hotel;
    },
    enabled: !!profile?.current_hotel_id,
  });

  // Get user's hotels
  const { data: userHotels, isLoading: hotelsLoading } = useQuery({
    queryKey: ['user-hotels', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('hotel_members')
        .select(`
          hotel_id,
          is_owner,
          hotels (*)
        `)
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data?.map(m => ({
        ...m.hotels,
        is_owner: m.is_owner,
      })) as (Hotel & { is_owner: boolean })[];
    },
    enabled: !!user?.id,
  });

  // Get hotel members
  const { data: hotelMembers, isLoading: membersLoading } = useQuery({
    queryKey: ['hotel-members', profile?.current_hotel_id],
    queryFn: async () => {
      if (!profile?.current_hotel_id) return [];
      
      const { data, error } = await supabase
        .from('hotel_members')
        .select('*')
        .eq('hotel_id', profile.current_hotel_id);
      
      if (error) throw error;

      // Fetch profiles and roles for each member
      const membersWithData = await Promise.all(
        (data || []).map(async (member) => {
          const [profileResult, rolesResult] = await Promise.all([
            supabase
              .from('profiles')
              .select('id, email, full_name, avatar_url')
              .eq('id', member.user_id)
              .single(),
            supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', member.user_id),
          ]);
          
          return {
            ...member,
            profile: profileResult.data || undefined,
            roles: rolesResult.data?.map(r => r.role) || [],
          } as HotelMember;
        })
      );

      return membersWithData;
    },
    enabled: !!profile?.current_hotel_id,
  });

  // Get pending invitations
  const { data: invitations, isLoading: invitationsLoading } = useQuery({
    queryKey: ['invitations', profile?.current_hotel_id],
    queryFn: async () => {
      if (!profile?.current_hotel_id) return [];
      
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('hotel_id', profile.current_hotel_id)
        .is('accepted_at', null)
        .gte('expires_at', new Date().toISOString());
      
      if (error) throw error;
      return data as Invitation[];
    },
    enabled: !!profile?.current_hotel_id,
  });

  // Switch hotel
  const switchHotel = useMutation({
    mutationFn: async (hotelId: string) => {
      if (!user?.id) throw new Error('No user');
      
      const { error } = await supabase
        .from('profiles')
        .update({ current_hotel_id: hotelId })
        .eq('id', user.id);
      
      if (error) throw error;
      return hotelId;
    },
    onSuccess: async () => {
      await refreshUserData();
      queryClient.invalidateQueries({ queryKey: ['current-hotel'] });
      queryClient.invalidateQueries({ queryKey: ['user-hotels'] });
      queryClient.invalidateQueries({ queryKey: ['hotel-members'] });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast.success('Hotel cambiado correctamente');
    },
    onError: (error) => {
      toast.error('Error al cambiar hotel: ' + error.message);
    },
  });

  // Send invitation
  const sendInvitation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: Invitation['role'] }) => {
      if (!profile?.current_hotel_id || !user?.id) throw new Error('No hotel selected');
      
      const { data, error } = await supabase
        .from('invitations')
        .insert({
          hotel_id: profile.current_hotel_id,
          email,
          role,
          invited_by: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as Invitation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast.success('Invitación enviada correctamente');
    },
    onError: (error) => {
      toast.error('Error al enviar invitación: ' + error.message);
    },
  });

  // Cancel invitation
  const cancelInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', invitationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast.success('Invitación cancelada');
    },
    onError: (error) => {
      toast.error('Error al cancelar invitación: ' + error.message);
    },
  });

  // Remove member
  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('hotel_members')
        .delete()
        .eq('id', memberId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotel-members'] });
      toast.success('Miembro eliminado del hotel');
    },
    onError: (error) => {
      toast.error('Error al eliminar miembro: ' + error.message);
    },
  });

  // Update hotel
  const updateHotel = useMutation({
    mutationFn: async (updates: Partial<Hotel>) => {
      if (!profile?.current_hotel_id) throw new Error('No hotel selected');
      
      const { error } = await supabase
        .from('hotels')
        .update(updates)
        .eq('id', profile.current_hotel_id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-hotel'] });
      toast.success('Hotel actualizado correctamente');
    },
    onError: (error) => {
      toast.error('Error al actualizar hotel: ' + error.message);
    },
  });

  return {
    currentHotel,
    userHotels,
    hotelMembers,
    invitations,
    isLoading: hotelLoading || hotelsLoading || membersLoading || invitationsLoading,
    switchHotel,
    sendInvitation,
    cancelInvitation,
    removeMember,
    updateHotel,
  };
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { Hotel, Invitation } from './useHotel';

export function useSuperAdmin() {
  const { user, roles } = useAuth();
  const queryClient = useQueryClient();
  const isSuperAdmin = roles.includes('super_admin');

  // Get all hotels (super admin only)
  const { data: allHotels, isLoading: hotelsLoading } = useQuery({
    queryKey: ['all-hotels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hotels')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Hotel[];
    },
    enabled: isSuperAdmin,
  });

  // Get all hotel members with profiles
  const { data: allMembers, isLoading: membersLoading } = useQuery({
    queryKey: ['all-hotel-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hotel_members')
        .select('*');
      
      if (error) throw error;
      
      // Fetch profiles for each member
      const membersWithProfiles = await Promise.all(
        (data || []).map(async (member) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, email, full_name, avatar_url')
            .eq('id', member.user_id)
            .single();
          
          return {
            ...member,
            profile,
          };
        })
      );

      return membersWithProfiles;
    },
    enabled: isSuperAdmin,
  });

  // Get all pending invitations
  const { data: allInvitations, isLoading: invitationsLoading } = useQuery({
    queryKey: ['all-invitations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .is('accepted_at', null)
        .gte('expires_at', new Date().toISOString());
      
      if (error) throw error;
      return data as Invitation[];
    },
    enabled: isSuperAdmin,
  });

  // Create new hotel
  const createHotel = useMutation({
    mutationFn: async ({ name, slug, address, phone, email, website }: {
      name: string;
      slug: string;
      address?: string;
      phone?: string;
      email?: string;
      website?: string;
    }) => {
      const { data, error } = await supabase
        .from('hotels')
        .insert({
          name,
          slug,
          address,
          phone,
          email,
          website,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as Hotel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-hotels'] });
      toast.success('Hotel creado correctamente');
    },
    onError: (error) => {
      toast.error('Error al crear hotel: ' + error.message);
    },
  });

  // Delete hotel
  const deleteHotel = useMutation({
    mutationFn: async (hotelId: string) => {
      const { error } = await supabase
        .from('hotels')
        .delete()
        .eq('id', hotelId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-hotels'] });
      toast.success('Hotel eliminado correctamente');
    },
    onError: (error) => {
      toast.error('Error al eliminar hotel: ' + error.message);
    },
  });

  // Invite owner to hotel
  const inviteOwner = useMutation({
    mutationFn: async ({ hotelId, email }: { hotelId: string; email: string }) => {
      const { data, error } = await supabase
        .from('invitations')
        .insert({
          hotel_id: hotelId,
          email,
          role: 'admin',
          invited_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as Invitation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-invitations'] });
      toast.success('Invitación de owner enviada');
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
      queryClient.invalidateQueries({ queryKey: ['all-invitations'] });
      toast.success('Invitación cancelada');
    },
    onError: (error) => {
      toast.error('Error al cancelar invitación: ' + error.message);
    },
  });

  return {
    isSuperAdmin,
    allHotels,
    allMembers,
    allInvitations,
    isLoading: hotelsLoading || membersLoading || invitationsLoading,
    createHotel,
    deleteHotel,
    inviteOwner,
    cancelInvitation,
  };
}

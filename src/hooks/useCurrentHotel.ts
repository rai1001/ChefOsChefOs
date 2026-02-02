import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Hook que devuelve el hotel_id actual del usuario.
 * Útil para incluirlo en operaciones de INSERT.
 */
export function useCurrentHotelId() {
  const { profile } = useAuth();
  return profile?.current_hotel_id || null;
}

/**
 * Hook que valida que el usuario tenga un hotel seleccionado.
 * Retorna un error si no hay hotel.
 */
export function useRequireHotel() {
  const hotelId = useCurrentHotelId();
  
  return {
    hotelId,
    hasHotel: !!hotelId,
    error: !hotelId ? 'Debes seleccionar un hotel primero' : null,
  };
}

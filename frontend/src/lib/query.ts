import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export function invalidarTrasMutacion() {
  queryClient.invalidateQueries({ queryKey: ['movimientos'] });
  queryClient.invalidateQueries({ queryKey: ['inventario'] });
  queryClient.invalidateQueries({ queryKey: ['inicio'] });
  queryClient.invalidateQueries({ queryKey: ['kardex'] });
}

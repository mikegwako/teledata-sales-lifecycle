import { useAuth } from '@/contexts/AuthContext';

export function useCurrency() {
  const { profile } = useAuth();
  const currency = profile?.currency_preference || 'USD';
  
  const formatCurrency = (amount: number) => {
    if (currency === 'KSH') {
      return `KSh ${amount.toLocaleString()}`;
    }
    return `$${amount.toLocaleString()}`;
  };

  const currencyLabel = currency === 'KSH' ? 'KSh' : '$';
  
  return { currency, formatCurrency, currencyLabel };
}

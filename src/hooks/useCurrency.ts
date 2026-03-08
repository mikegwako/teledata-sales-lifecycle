import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useCallback } from 'react';

const RATE_CACHE_KEY = 'usd_ksh_rate';
const RATE_CACHE_TS_KEY = 'usd_ksh_rate_ts';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useCurrency() {
  const { profile } = useAuth();
  const currency = profile?.currency_preference || 'USD';
  const [exchangeRate, setExchangeRate] = useState<number | null>(() => {
    const cached = localStorage.getItem(RATE_CACHE_KEY);
    const ts = localStorage.getItem(RATE_CACHE_TS_KEY);
    if (cached && ts && Date.now() - Number(ts) < CACHE_DURATION) {
      return Number(cached);
    }
    return null;
  });
  const [rateLoading, setRateLoading] = useState(false);

  const fetchRate = useCallback(async () => {
    try {
      setRateLoading(true);
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      const data = await res.json();
      if (data?.rates?.KES) {
        const rate = data.rates.KES;
        setExchangeRate(rate);
        localStorage.setItem(RATE_CACHE_KEY, String(rate));
        localStorage.setItem(RATE_CACHE_TS_KEY, String(Date.now()));
      }
    } catch (err) {
      console.error('Failed to fetch exchange rate:', err);
    } finally {
      setRateLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch on mount if no cached rate or cache expired
    const ts = localStorage.getItem(RATE_CACHE_TS_KEY);
    if (!exchangeRate || !ts || Date.now() - Number(ts) >= CACHE_DURATION) {
      fetchRate();
    }

    // Refresh every 5 minutes
    const interval = setInterval(fetchRate, CACHE_DURATION);
    return () => clearInterval(interval);
  }, [fetchRate, exchangeRate]);

  const formatCurrency = (amount: number) => {
    if (currency === 'KSH') {
      if (exchangeRate) {
        const converted = amount * exchangeRate;
        return `KSh ${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
      }
      return `KSh ${amount.toLocaleString()}`;
    }
    return `$${amount.toLocaleString()}`;
  };

  const currencyLabel = currency === 'KSH' ? 'KSh' : '$';

  const rateInfo = exchangeRate
    ? `1 USD = ${exchangeRate.toLocaleString(undefined, { maximumFractionDigits: 2 })} KSh`
    : null;

  return { currency, formatCurrency, currencyLabel, exchangeRate, rateInfo, rateLoading };
}

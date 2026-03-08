import { useCurrency } from '@/hooks/useCurrency';
import { Badge } from '@/components/ui/badge';
import { RefreshCw } from 'lucide-react';

export function ExchangeRateBanner() {
  const { currency, rateInfo, rateLoading } = useCurrency();

  if (currency !== 'KSH' || !rateInfo) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground print:hidden">
      <Badge variant="outline" className="text-[10px] font-mono gap-1 border-accent/30 text-accent">
        {rateLoading && <RefreshCw className="h-3 w-3 animate-spin" />}
        {rateInfo}
      </Badge>
      <span className="text-[10px]">• Live rate • Updates every 5 min</span>
    </div>
  );
}

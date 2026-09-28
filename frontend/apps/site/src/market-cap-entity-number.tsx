import { splitMarketCapEntityNumber } from '../../../packages/ui/src/content/market-cap-page-model';

type MarketCapEntityNumberProps = Readonly<{
  value: string;
  prefix?: string;
  suffix?: string;
}>;

export function MarketCapEntityNumber({ value, prefix = '#', suffix = '' }: MarketCapEntityNumberProps) {
  const [start, end] = splitMarketCapEntityNumber(value);
  const fullLabel = `${prefix}${value}${suffix}`;
  return (
    <span className="market-entity-number" title={fullLabel}>
      <span className="market-entity-number-start">{prefix}{start}</span>
      <span className="market-entity-number-end">{end}{suffix}</span>
    </span>
  );
}

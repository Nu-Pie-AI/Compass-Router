export interface CurrencyContext {
  locale: string;
  region: string;
  currencyCode: string;
  currencySymbol: string;
  monthlyBudgetOptions: string[];
  hiringBudgetOptions: string[];
}

export function localizeBudgetQuestion<T extends { text: string; options: string[]; allowMultiple?: boolean }>(
  question: T,
  currencyContext: CurrencyContext
): T {
  if (!isBudgetQuestion(question.text, question.options)) {
    return question;
  }

  const isHiringQuestion =
    /hire|hiring|developer|engineer|consultant|agency|staff|resource|talent|team member/i.test(
      question.text
    );

  return {
    ...question,
    options: isHiringQuestion
      ? currencyContext.hiringBudgetOptions
      : currencyContext.monthlyBudgetOptions,
  };
}

const REGION_TO_CURRENCY: Record<string, { code: string; symbol: string }> = {
  US: { code: 'USD', symbol: '$' },
  CA: { code: 'CAD', symbol: 'CA$' },
  GB: { code: 'GBP', symbol: 'GBP ' },
  IN: { code: 'INR', symbol: 'INR ' },
  AU: { code: 'AUD', symbol: 'A$' },
  NZ: { code: 'NZD', symbol: 'NZ$' },
  SG: { code: 'SGD', symbol: 'S$' },
  AE: { code: 'AED', symbol: 'AED ' },
  SA: { code: 'SAR', symbol: 'SAR ' },
  EU: { code: 'EUR', symbol: 'EUR ' },
  DE: { code: 'EUR', symbol: 'EUR ' },
  FR: { code: 'EUR', symbol: 'EUR ' },
  ES: { code: 'EUR', symbol: 'EUR ' },
  IT: { code: 'EUR', symbol: 'EUR ' },
  NL: { code: 'EUR', symbol: 'EUR ' },
};

const CURRENCY_OPTION_PRESETS: Record<
  string,
  Pick<CurrencyContext, 'monthlyBudgetOptions' | 'hiringBudgetOptions'>
> = {
  USD: {
    monthlyBudgetOptions: [
      'Under $50/month',
      '$50-$200/month',
      '$200-$500/month',
      '$500+/month',
    ],
    hiringBudgetOptions: [
      'Under $50,000',
      '$50,000-$100,000',
      '$100,000-$150,000',
      'Over $150,000',
    ],
  },
  CAD: {
    monthlyBudgetOptions: [
      'Under CA$75/month',
      'CA$75-CA$300/month',
      'CA$300-CA$750/month',
      'CA$750+/month',
    ],
    hiringBudgetOptions: [
      'Under CA$70,000',
      'CA$70,000-CA$120,000',
      'CA$120,000-CA$170,000',
      'Over CA$170,000',
    ],
  },
  GBP: {
    monthlyBudgetOptions: [
      'Under GBP 40/month',
      'GBP 40-GBP 150/month',
      'GBP 150-GBP 400/month',
      'GBP 400+/month',
    ],
    hiringBudgetOptions: [
      'Under GBP 40,000',
      'GBP 40,000-GBP 80,000',
      'GBP 80,000-GBP 120,000',
      'Over GBP 120,000',
    ],
  },
  EUR: {
    monthlyBudgetOptions: [
      'Under EUR 50/month',
      'EUR 50-EUR 200/month',
      'EUR 200-EUR 500/month',
      'EUR 500+/month',
    ],
    hiringBudgetOptions: [
      'Under EUR 45,000',
      'EUR 45,000-EUR 90,000',
      'EUR 90,000-EUR 130,000',
      'Over EUR 130,000',
    ],
  },
  INR: {
    monthlyBudgetOptions: [
      'Under INR 5,000/month',
      'INR 5,000-INR 15,000/month',
      'INR 15,000-INR 40,000/month',
      'INR 40,000+/month',
    ],
    hiringBudgetOptions: [
      'Under INR 8 lakh',
      'INR 8-15 lakh',
      'INR 15-25 lakh',
      'Over INR 25 lakh',
    ],
  },
  AUD: {
    monthlyBudgetOptions: [
      'Under A$80/month',
      'A$80-A$300/month',
      'A$300-A$700/month',
      'A$700+/month',
    ],
    hiringBudgetOptions: [
      'Under A$80,000',
      'A$80,000-A$130,000',
      'A$130,000-A$180,000',
      'Over A$180,000',
    ],
  },
  SGD: {
    monthlyBudgetOptions: [
      'Under S$70/month',
      'S$70-S$250/month',
      'S$250-S$600/month',
      'S$600+/month',
    ],
    hiringBudgetOptions: [
      'Under S$60,000',
      'S$60,000-S$110,000',
      'S$110,000-S$160,000',
      'Over S$160,000',
    ],
  },
  AED: {
    monthlyBudgetOptions: [
      'Under AED 300/month',
      'AED 300-AED 1,000/month',
      'AED 1,000-AED 3,000/month',
      'AED 3,000+/month',
    ],
    hiringBudgetOptions: [
      'Under AED 180,000',
      'AED 180,000-AED 300,000',
      'AED 300,000-AED 450,000',
      'Over AED 450,000',
    ],
  },
};

const TIMEZONE_TO_REGION: Record<string, string> = {
  'Asia/Calcutta': 'IN',
  'Asia/Kolkata': 'IN',
  'Europe/London': 'GB',
  'Europe/Dublin': 'IE',
  'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE',
  'Europe/Madrid': 'ES',
  'Europe/Rome': 'IT',
  'Europe/Amsterdam': 'NL',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Pacific/Auckland': 'NZ',
  'Asia/Singapore': 'SG',
  'Asia/Dubai': 'AE',
  'Asia/Riyadh': 'SA',
};

export function resolveCurrencyContext(
  acceptLanguageHeader?: string | null,
  explicitLocale?: string | null,
  timeZone?: string | null
): CurrencyContext {
  const locale = explicitLocale || extractPrimaryLocale(acceptLanguageHeader);
  const localeRegion = extractRegion(locale);
  const timeZoneRegion = extractRegionFromTimeZone(timeZone);
  const region =
    localeRegion && localeRegion !== 'US'
      ? localeRegion
      : timeZoneRegion || localeRegion;

  const currency =
    REGION_TO_CURRENCY[region] ||
    (region && REGION_TO_CURRENCY.EU && isLikelyEuroRegion(region)
      ? REGION_TO_CURRENCY.EU
      : REGION_TO_CURRENCY.US);

  const preset =
    CURRENCY_OPTION_PRESETS[currency.code] || CURRENCY_OPTION_PRESETS.USD;

  return {
    locale,
    region,
    currencyCode: currency.code,
    currencySymbol: currency.symbol,
    monthlyBudgetOptions: preset.monthlyBudgetOptions,
    hiringBudgetOptions: preset.hiringBudgetOptions,
  };
}

function extractPrimaryLocale(acceptLanguageHeader?: string | null) {
  if (!acceptLanguageHeader) return 'en-US';
  const firstLocale = acceptLanguageHeader.split(',')[0]?.trim();
  return firstLocale || 'en-US';
}

function extractRegion(locale: string) {
  const match = locale.match(/-([A-Z]{2})$/i);
  return match?.[1]?.toUpperCase() || 'US';
}

function extractRegionFromTimeZone(timeZone?: string | null) {
  if (!timeZone) {
    return null;
  }

  return TIMEZONE_TO_REGION[timeZone] || null;
}

function isLikelyEuroRegion(region: string) {
  return ['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'PT', 'IE', 'AT', 'FI'].includes(
    region
  );
}

function isBudgetQuestion(text: string, options: string[]) {
  if (/budget|price|pricing|cost|spend|range/i.test(text)) {
    return true;
  }

  const optionsText = options.join(' ');

  if (!/[$]|usd|eur|gbp|cad|aud|sgd|aed|sar|inr|lakh/i.test(optionsText)) {
    return false;
  }

  return !/urgent|urgency|timeline|implementation|week|weeks|day|days/i.test(
    text
  );
}

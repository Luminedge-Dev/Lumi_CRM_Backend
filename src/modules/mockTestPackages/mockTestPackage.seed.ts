// Default mock-test packages created by POST /api/mock-test-packages/seed (existing packages are
// never overwritten). Prices are in BDT.

const FEATURES = [
  'Flexible mock test schedule',
  'Real exam experience',
  'Official test standard question',
  'Result published in quick time',
  'Detailed mock feedback',
  'Wireless headphones',
];

const pricing = (one: number, three: number, five: number) => [
  { testCount: 1, fee: one },
  { testCount: 3, fee: three },
  { testCount: 5, fee: five },
];

export const INITIAL_PACKAGES = [
  { testType: 'IELTS', features: FEATURES, pricing: pricing(1550, 3000, 4500), isActive: true },
  { testType: 'PTE', features: FEATURES, pricing: pricing(1750, 3500, 5000), isActive: true },
  { testType: 'GRE', features: FEATURES, pricing: pricing(2000, 4000, 6000), isActive: true },
  { testType: 'TOEFL', features: FEATURES, pricing: pricing(1800, 3600, 5400), isActive: true },
];

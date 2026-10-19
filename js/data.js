// Card catalog: fees, earning rates, trackable credits and other perks.
// Researched October 2026. Issuers change these often, so every amount can be edited per card in the app.
//
// Benefit periods:
//   monthly | quarterly | semiannual (Jan–Jun, Jul–Dec) | annual (calendar year)
//   cardyear (resets on your card anniversary) | multiyear (once every `years` years)
//   auto: true — posts by itself; listed without a deadline so it doesn't look urgent
// Benefit kinds:
//   amount — log dollars spent against the credit; checks itself off at the full amount
//   check  — a yes/no perk with an estimated dollar `value` (set to 0 for pure reminders)

export const CATEGORIES = [
  { id: 'dining', label: 'Dining & restaurants', icon: '🍽️' },
  { id: 'groceries', label: 'Groceries (supermarkets)', icon: '🛒' },
  { id: 'costco', label: 'Costco', icon: '🏬', note: 'Costco warehouses take only Visa cards.' },
  { id: 'amazon', label: 'Amazon', icon: '📦' },
  { id: 'gas', label: 'Gas stations', icon: '⛽' },
  { id: 'ev', label: 'EV charging', icon: '🔌' },
  { id: 'flights', label: 'Flights (booked with the airline)', icon: '✈️' },
  { id: 'alaska', label: 'Alaska / Hawaiian Airlines', icon: '🌺' },
  { id: 'aa', label: 'American Airlines', icon: '🛫' },
  { id: 'hotels', label: 'Hotels (booked with the hotel)', icon: '🏨' },
  { id: 'portal', label: 'Travel booked in a card’s portal', icon: '🧳', note: 'Chase Travel, Capital One Travel, Amex Travel — each card only earns the bonus in its own portal.' },
  { id: 'rental', label: 'Rental cars', icon: '🚗' },
  { id: 'rideshare', label: 'Rideshare & transit', icon: '🚕' },
  { id: 'drugstore', label: 'Drugstores', icon: '💊' },
  { id: 'streaming', label: 'Streaming services', icon: '📺' },
  { id: 'internet', label: 'Internet, cable & phone', icon: '📶' },
  { id: 'office', label: 'Office supply stores', icon: '📎' },
  { id: 'entertainment', label: 'Entertainment & tickets', icon: '🎟️' },
  { id: 'utilities', label: 'Utilities', icon: '💡' },
  { id: 'foreign', label: 'Purchases abroad', icon: '🌍', note: 'Cards with a 3% foreign transaction fee are ranked lower.' },
  { id: 'other', label: 'Everything else', icon: '💳' },
];

// Reward currencies with default cents-per-point values (editable in Settings).
export const CURRENCIES = {
  UR: { label: 'Chase Ultimate Rewards', brief: 'Chase UR', short: 'pts', cpp: 1.5, note: 'Worth 1.5¢+ when pooled into a Sapphire card; 1¢ as cash.' },
  MR: { label: 'Amex Membership Rewards', brief: 'Amex MR', short: 'pts', cpp: 1.5 },
  C1: { label: 'Capital One miles', brief: 'Capital One', short: 'mi', cpp: 1.5 },
  ATMOS: { label: 'Atmos Rewards points', brief: 'Atmos', short: 'pts', cpp: 1.3 },
  AA: { label: 'AAdvantage miles', brief: 'AAdvantage', short: 'mi', cpp: 1.4 },
  CASH: { label: 'Cash back', short: '%', cpp: 1 },
};

// Quarterly 5% categories. Add new quarters here (or in Settings) as issuers announce them.
export const ROTATING = {
  chase: {
    '2026-Q4': { cats: ['groceries', 'dining'], note: 'Grocery stores (not Walmart/Target), dining, American Red Cross' },
  },
  discover: {
    '2026-Q4': { cats: ['dining', 'entertainment', 'utilities'], note: 'Restaurants, entertainment, utilities' },
  },
};

const GE = { id: 'global-entry', name: 'Global Entry / TSA PreCheck credit', kind: 'amount', amount: 120, period: 'multiyear', years: 4, note: 'Pay the application fee with this card.' };

export const CATALOG = [
  {
    id: 'csr', name: 'Chase Sapphire Reserve', issuer: 'Chase', network: 'Visa', fee: 795, currency: 'UR', color: '#1d2a44', ftf: false,
    earn: [
      { cats: ['portal'], rate: 8, note: '8x on Chase Travel (incl. The Edit)' },
      { cats: ['flights', 'hotels', 'alaska', 'aa'], rate: 4, note: 'Booked directly' },
      { cats: ['dining'], rate: 3 },
      { cats: ['rideshare'], rate: 5, note: 'Lyft only, through Sep 2027; other transit 1x' },
    ],
    base: 1,
    benefits: [
      { id: 'travel', name: '$300 travel credit', kind: 'amount', amount: 300, period: 'cardyear', note: 'Applies automatically to the first $300 of travel each card year.' },
      { id: 'edit', name: 'The Edit hotel credit', kind: 'amount', amount: 250, period: 'semiannual', note: 'Prepaid 2+ night stay at an Edit property via Chase Travel.' },
      { id: 'chase-hotel', name: 'Select Chase Travel hotel credit', kind: 'amount', amount: 250, period: 'annual', expires: '2026-12-31', note: 'One-time 2026 credit on select hotels booked through Chase Travel.' },
      { id: 'dining', name: 'Sapphire Exclusive Tables dining', kind: 'amount', amount: 150, period: 'semiannual', note: 'OpenTable restaurants in the Exclusive Tables program.' },
      { id: 'stubhub', name: 'StubHub / viagogo credit', kind: 'amount', amount: 150, period: 'semiannual', expires: '2027-12-31', note: 'Activation required.' },
      { id: 'doordash', name: 'DoorDash promos', kind: 'amount', amount: 25, period: 'monthly', expires: '2027-12-31', note: '$5 restaurant + two $10 grocery/retail promos each month (with DashPass). Edit the amount if your app shows more.' },
      { id: 'lyft', name: 'Lyft credit', kind: 'amount', amount: 10, period: 'monthly', expires: '2027-09-30' },
      { id: 'peloton', name: 'Peloton membership credit', kind: 'amount', amount: 10, period: 'monthly', expires: '2027-12-31' },
      { id: 'apple', name: 'Apple TV+ & Apple Music', kind: 'check', value: 288, period: 'annual', expires: '2027-06-22', note: 'Activate the subscriptions; counts only if you would pay for them.' },
      GE,
    ],
    perks: [
      'Priority Pass Select + Chase Sapphire Lounges (2 guests)',
      'Points Boost: up to 2¢/pt on select Chase Travel bookings',
      'Complimentary DashPass',
      'IHG One Rewards Platinum Elite status',
      'Spend $75k/yr: IHG Diamond, Southwest A-List, $500 Southwest credit, $250 Shops at Chase credit',
      'Primary rental car coverage; trip cancellation, delay and lost-luggage protection',
      'No foreign transaction fees',
    ],
  },
  {
    id: 'csp', name: 'Chase Sapphire Preferred', issuer: 'Chase', network: 'Visa', fee: 95, currency: 'UR', color: '#1f3f73', ftf: false,
    earn: [
      { cats: ['portal'], rate: 5, note: 'Chase Travel' },
      { cats: ['dining', 'streaming'], rate: 3 },
      { cats: ['groceries'], rate: 3, note: 'Online grocery only' },
      { cats: ['flights', 'hotels', 'alaska', 'aa', 'rental', 'rideshare'], rate: 2 },
    ],
    base: 1,
    benefits: [
      { id: 'hotel', name: '$50 Chase Travel hotel credit', kind: 'amount', amount: 50, period: 'cardyear' },
      { id: 'anniv', name: '10% anniversary points bonus', kind: 'check', value: 0, period: 'cardyear', auto: true, note: 'Automatic; reminder only.' },
    ],
    perks: ['Complimentary DashPass', 'Primary rental car coverage', 'Trip delay and cancellation protection', 'No foreign transaction fees'],
  },
  {
    id: 'freedom', name: 'Chase Freedom (legacy)', issuer: 'Chase', network: 'Visa', fee: 0, currency: 'UR', color: '#2c6fb7', ftf: true, rotating: 'chase',
    earn: [], base: 1,
    benefits: [
      { id: 'activate', name: 'Activate 5% quarterly categories', kind: 'check', value: 0, period: 'quarterly', deadlineDay: 14, note: 'Activate at chasebonus.com — retroactive if done by the 14th of the quarter’s last month. 5% on up to $1,500.' },
    ],
    perks: ['Points pool into your Sapphire account for higher value', '3% foreign transaction fee'],
  },
  {
    id: 'freedom-flex', name: 'Chase Freedom Flex', issuer: 'Chase', network: 'Mastercard', fee: 0, currency: 'UR', color: '#2f80c9', ftf: true, rotating: 'chase',
    earn: [
      { cats: ['portal'], rate: 5, note: 'Chase Travel' },
      { cats: ['dining', 'drugstore'], rate: 3 },
    ],
    base: 1,
    benefits: [
      { id: 'activate', name: 'Activate 5% quarterly categories', kind: 'check', value: 0, period: 'quarterly', deadlineDay: 14, note: 'Activate at chasebonus.com — retroactive if done by the 14th of the quarter’s last month. 5% on up to $1,500.' },
    ],
    perks: ['Cell phone protection (pay your bill with the card)', 'Points pool into your Sapphire account', '3% foreign transaction fee'],
  },
  {
    id: 'freedom-unlimited', name: 'Chase Freedom Unlimited', issuer: 'Chase', network: 'Visa', fee: 0, currency: 'UR', color: '#3a8fd9', ftf: true,
    earn: [
      { cats: ['portal'], rate: 5, note: 'Chase Travel' },
      { cats: ['dining', 'drugstore'], rate: 3 },
    ],
    base: 1.5,
    benefits: [],
    perks: ['Points pool into your Sapphire account', '3% foreign transaction fee'],
  },
  {
    id: 'ink-cash', name: 'Chase Ink Business Cash', issuer: 'Chase', network: 'Visa', fee: 0, currency: 'UR', color: '#4b5563', ftf: true,
    earn: [
      { cats: ['office', 'internet'], rate: 5, note: 'Up to $25k combined per card year' },
      { cats: ['gas', 'dining'], rate: 2, note: 'Up to $25k combined per card year' },
    ],
    base: 1,
    benefits: [],
    perks: ['Office supply stores sell gift cards (e.g. Amazon) — a common way to earn 5x elsewhere', 'Points pool into your Sapphire account', 'Primary rental car coverage for business rentals', '3% foreign transaction fee'],
  },
  {
    id: 'amex-gold', name: 'American Express Gold', issuer: 'American Express', network: 'Amex', fee: 325, currency: 'MR', color: '#b8892b', ftf: false,
    earn: [
      { cats: ['dining'], rate: 4, note: 'Up to $50k/yr' },
      { cats: ['groceries'], rate: 4, note: 'U.S. supermarkets, up to $25k/yr' },
      { cats: ['flights', 'alaska', 'aa'], rate: 3, note: 'Booked directly or via Amex Travel' },
      { cats: ['portal'], rate: 2, note: 'Prepaid hotels on Amex Travel' },
    ],
    base: 1,
    benefits: [
      { id: 'uber', name: 'Uber Cash', kind: 'amount', amount: 10, period: 'monthly', note: 'Add the card to Uber; U.S. rides or Uber Eats.' },
      { id: 'dining', name: 'Dining credit', kind: 'amount', amount: 10, period: 'monthly', note: 'Grubhub, Cheesecake Factory, Five Guys, Buffalo Wild Wings, Wonder (enroll).' },
      { id: 'resy', name: 'Resy credit', kind: 'amount', amount: 50, period: 'semiannual', note: 'U.S. Resy restaurants (enroll).' },
      { id: 'dunkin', name: 'Dunkin’ credit', kind: 'amount', amount: 7, period: 'monthly', note: 'U.S. Dunkin’ (enroll).' },
    ],
    perks: ['The Hotel Collection: $100 property credit on 2+ night stays', 'Baggage insurance, secondary car rental coverage', 'No foreign transaction fees'],
  },
  {
    id: 'amex-plat', name: 'American Express Platinum', issuer: 'American Express', network: 'Amex', fee: 895, currency: 'MR', color: '#8e9aa6', ftf: false,
    earn: [
      { cats: ['flights', 'alaska', 'aa'], rate: 5, note: 'Booked directly or via Amex Travel' },
      { cats: ['portal'], rate: 5, note: 'Prepaid hotels on Amex Travel' },
    ],
    base: 1,
    benefits: [
      { id: 'hotel', name: 'Fine Hotels + Resorts / Hotel Collection', kind: 'amount', amount: 300, period: 'semiannual', note: 'Prepaid via Amex Travel (Hotel Collection needs 2+ nights).' },
      { id: 'resy', name: 'Resy credit', kind: 'amount', amount: 100, period: 'quarterly' },
      { id: 'lululemon', name: 'lululemon credit', kind: 'amount', amount: 75, period: 'quarterly' },
      { id: 'digital', name: 'Digital entertainment credit', kind: 'amount', amount: 25, period: 'monthly', note: 'Disney+, Hulu, ESPN+, Peacock, NYT, WSJ, etc.' },
      { id: 'uber', name: 'Uber Cash', kind: 'amount', amount: 15, period: 'monthly', note: 'Plus a $20 bonus in December.' },
      { id: 'uber-dec', name: 'Uber Cash December bonus', kind: 'amount', amount: 20, period: 'annual' },
      { id: 'uber-one', name: 'Uber One membership credit', kind: 'amount', amount: 120, period: 'annual' },
      { id: 'airline', name: 'Airline incidental fee credit', kind: 'amount', amount: 200, period: 'annual', note: 'Select one airline first.' },
      { id: 'clear', name: 'CLEAR+ credit', kind: 'amount', amount: 209, period: 'annual' },
      { id: 'oura', name: 'Oura Ring credit', kind: 'amount', amount: 200, period: 'annual' },
      { id: 'walmart', name: 'Walmart+ membership credit', kind: 'amount', amount: 12.95, period: 'monthly' },
      { id: 'equinox', name: 'Equinox credit', kind: 'amount', amount: 300, period: 'annual' },
      { id: 'saks', name: 'Saks Fifth Avenue credit', kind: 'amount', amount: 50, period: 'semiannual', note: 'Check that this is still offered on your card.' },
      GE,
    ],
    perks: ['Centurion Lounges, Priority Pass, Delta Sky Club (when flying Delta)', 'Hilton Gold & Marriott Gold status', 'No foreign transaction fees'],
  },
  {
    id: 'venture-x', name: 'Capital One Venture X', issuer: 'Capital One', network: 'Visa', fee: 395, currency: 'C1', color: '#22313f', ftf: false,
    earn: [
      { cats: ['portal'], rate: 10, note: 'Hotels & rental cars on Capital One Travel (5x flights)' },
      { cats: ['rental'], rate: 2, note: '10x if booked on Capital One Travel' },
    ],
    base: 2,
    benefits: [
      { id: 'travel', name: '$300 Capital One Travel credit', kind: 'amount', amount: 300, period: 'cardyear', note: 'Bookings through Capital One Travel only.' },
      { id: 'miles', name: '10,000 anniversary miles', kind: 'check', value: 100, period: 'cardyear', auto: true, note: 'Posts automatically on your anniversary (~$100).' },
      GE,
    ],
    perks: ['Capital One Lounges + Priority Pass (authorized users need a $125/yr fee since Feb 2026)', 'Hertz President’s Circle status', 'Cell phone protection', 'Primary rental car coverage', 'No foreign transaction fees'],
  },
  {
    id: 'discover-it', name: 'Discover it Cash Back', issuer: 'Discover (Capital One)', network: 'Discover', fee: 0, currency: 'CASH', color: '#e8762d', ftf: false, rotating: 'discover',
    earn: [], base: 1,
    benefits: [
      { id: 'activate', name: 'Activate 5% quarterly categories', kind: 'check', value: 0, period: 'quarterly', note: 'Not retroactive — only purchases after activation earn 5%. Up to $1,500.' },
    ],
    perks: ['No foreign transaction fees', 'Acceptance is weaker abroad and at Costco'],
  },
  {
    id: 'costco', name: 'Costco Anywhere Visa (Citi)', issuer: 'Citi', network: 'Visa', fee: 0, currency: 'CASH', color: '#c8102e', ftf: false,
    earn: [
      { cats: ['gas'], rate: 4, note: '5% at Costco gas; up to $7k/yr combined with EV, then 1%' },
      { cats: ['ev'], rate: 4, note: 'Shares the $7k/yr gas cap' },
      { cats: ['dining'], rate: 3 },
      { cats: ['flights', 'hotels', 'alaska', 'aa', 'rental', 'portal'], rate: 3, note: 'Eligible travel, incl. Costco Travel' },
      { cats: ['costco'], rate: 2 },
    ],
    base: 1,
    benefits: [
      { id: 'certificate', name: 'Redeem annual reward certificate', kind: 'check', value: 0, period: 'annual', note: 'Issued with the February statement; redeem at Costco by Dec 31. (Cash back, so it isn’t counted as perk value.)' },
    ],
    perks: ['Requires a Costco membership', 'No foreign transaction fees', 'Citi purchase and travel protections'],
  },
  {
    id: 'aa-mileup', name: 'Citi AAdvantage MileUp', issuer: 'Citi', network: 'Mastercard', fee: 0, currency: 'AA', color: '#0b6fae', ftf: true,
    earn: [
      { cats: ['groceries'], rate: 2 },
      { cats: ['aa'], rate: 2 },
    ],
    base: 1,
    benefits: [],
    perks: ['25% back on American Airlines inflight food and drinks', 'Miles count toward AAdvantage Loyalty Points', '3% foreign transaction fee'],
  },
  {
    id: 'atmos-ascent', name: 'Atmos Rewards Ascent (BofA)', issuer: 'Bank of America', network: 'Visa', fee: 95, currency: 'ATMOS', color: '#0a5c5a', ftf: false,
    earn: [
      { cats: ['alaska'], rate: 3 },
      { cats: ['gas', 'ev', 'internet', 'streaming', 'rideshare'], rate: 2, note: 'Gas, EV charging, cable, streaming, local transit & rideshare' },
    ],
    base: 1,
    benefits: [
      { id: 'companion', name: 'Companion Fare ($99 + tax)', kind: 'check', value: 250, period: 'cardyear', note: 'Renews each anniversary after $6,000 spend in the prior card year. Set the value to what you saved.' },
    ],
    perks: ['Free checked bag + priority boarding on Alaska/Hawaiian (log each use under extra value)', '20% back on inflight purchases', '$100 off Alaska Lounge+ membership', '10% points bonus with an eligible BofA account', 'No foreign transaction fees'],
  },
  {
    id: 'prime-visa', name: 'Amazon Prime Visa', issuer: 'Chase', network: 'Visa', fee: 0, currency: 'CASH', color: '#232f3e', ftf: false,
    earn: [
      { cats: ['amazon'], rate: 5, note: 'Amazon & Whole Foods, with Prime' },
      { cats: ['portal'], rate: 5, note: 'Chase Travel' },
      { cats: ['dining', 'gas', 'ev', 'rideshare'], rate: 2 },
    ],
    base: 1, benefits: [], perks: ['No foreign transaction fees'],
  },
  {
    id: 'double-cash', name: 'Citi Double Cash', issuer: 'Citi', network: 'Mastercard', fee: 0, currency: 'CASH', color: '#5b6b7d', ftf: true,
    earn: [], base: 2, benefits: [], perks: ['3% foreign transaction fee'],
  },
  {
    id: 'custom', name: 'Other card (custom)', issuer: '', network: 'Visa', fee: 0, currency: 'CASH', color: '#6b7280', ftf: false,
    earn: [], base: 1, benefits: [], perks: [], custom: true,
  },
];

export const catalogById = Object.fromEntries(CATALOG.map((c) => [c.id, c]));

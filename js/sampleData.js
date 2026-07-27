// Realistic sample data (July 2026). Shapes mirror the Supabase schema so the
// swap to real data is a data-layer change only. Amounts in ₱.

export const EXPENSE_CATEGORIES = [
  "Groceries", "Dining", "Transport", "Utilities", "Rent",
  "Shopping", "Health", "Subscriptions", "Others",
];
export const PAYMENT_METHODS = ["Cash", "GCash", "Card", "Bank Transfer"];

let n = 0;
const id = (p) => `${p}_${(++n).toString(36)}${Date.now().toString(36).slice(-3)}`;

export function seed() {
  return {
    profile: { name: "Mark", email: "mark@example.com", savingsGoal: 150000 },

    // Semi-monthly cutoffs. monthly_gross drives the statutory math.
    salary: [
      { id: id("sal"), pay_date: "2026-06-15", period: "1st cutoff", gross: 22500, monthly_gross: 45000 },
      { id: id("sal"), pay_date: "2026-06-30", period: "2nd cutoff", gross: 22500, monthly_gross: 45000 },
      { id: id("sal"), pay_date: "2026-07-15", period: "1st cutoff", gross: 22500, monthly_gross: 45000 },
    ],

    expenses: [
      { id: id("exp"), date: "2026-07-24", item: "Weekly grocery run", category: "Groceries", merchant: "Puregold", amount: 3480.50, payment_method: "GCash", recurring: false, notes: "" },
      { id: id("exp"), date: "2026-07-23", item: "Grab to office", category: "Transport", merchant: "Grab", amount: 214, payment_method: "GCash", recurring: false, notes: "" },
      { id: id("exp"), date: "2026-07-22", item: "Lunch with team", category: "Dining", merchant: "Mang Inasal", amount: 265, payment_method: "Cash", recurring: false, notes: "" },
      { id: id("exp"), date: "2026-07-21", item: "Coffee", category: "Dining", merchant: "Kubo Coffee", amount: 150, payment_method: "Cash", recurring: false, notes: "" },
      { id: id("exp"), date: "2026-07-20", item: "Meralco", category: "Utilities", merchant: "Meralco", amount: 2340, payment_method: "Bank Transfer", recurring: true, notes: "Electric bill" },
      { id: id("exp"), date: "2026-07-19", item: "Netflix", category: "Subscriptions", merchant: "Netflix", amount: 549, payment_method: "Card", recurring: true, notes: "" },
      { id: id("exp"), date: "2026-07-18", item: "Pharmacy", category: "Health", merchant: "Mercury Drug", amount: 612.75, payment_method: "Cash", recurring: false, notes: "Vitamins" },
      { id: id("exp"), date: "2026-07-17", item: "Jeepney fares", category: "Transport", merchant: "—", amount: 96, payment_method: "Cash", recurring: false, notes: "" },
      { id: id("exp"), date: "2026-07-16", item: "Dinner out", category: "Dining", merchant: "Jollibee", amount: 385, payment_method: "GCash", recurring: false, notes: "" },
      { id: id("exp"), date: "2026-07-15", item: "New running shoes", category: "Shopping", merchant: "Shopee", amount: 2899, payment_method: "Card", recurring: false, notes: "" },
      { id: id("exp"), date: "2026-07-12", item: "Grocery", category: "Groceries", merchant: "SM Supermarket", amount: 2760.25, payment_method: "GCash", recurring: false, notes: "" },
      { id: id("exp"), date: "2026-07-10", item: "Water bill", category: "Utilities", merchant: "Maynilad", amount: 540, payment_method: "Bank Transfer", recurring: true, notes: "" },
      { id: id("exp"), date: "2026-07-08", item: "Internet", category: "Utilities", merchant: "PLDT", amount: 1699, payment_method: "Bank Transfer", recurring: true, notes: "Fibr plan" },
      { id: id("exp"), date: "2026-07-05", item: "Spotify", category: "Subscriptions", merchant: "Spotify", amount: 194, payment_method: "Card", recurring: true, notes: "" },
      { id: id("exp"), date: "2026-07-03", item: "Coffee beans", category: "Groceries", merchant: "Kubo Coffee", amount: 480, payment_method: "Cash", recurring: false, notes: "" },
      { id: id("exp"), date: "2026-07-01", item: "Condo rent", category: "Rent", merchant: "Landlord", amount: 11000, payment_method: "Bank Transfer", recurring: true, notes: "Monthly" },
      // last month, for trend
      { id: id("exp"), date: "2026-06-28", item: "Grocery", category: "Groceries", merchant: "Puregold", amount: 3120, payment_method: "GCash", recurring: false, notes: "" },
      { id: id("exp"), date: "2026-06-15", item: "Condo rent", category: "Rent", merchant: "Landlord", amount: 11000, payment_method: "Bank Transfer", recurring: true, notes: "" },
      { id: id("exp"), date: "2026-06-10", item: "Birthday gift", category: "Shopping", merchant: "Lazada", amount: 1850, payment_method: "Card", recurring: false, notes: "" },
    ],

    loans: [
      { id: "loan_emergency", lender: "BPI Personal Loan", reason: "Emergency loan", original_amount: 25000, next_due: "2026-08-05" },
    ],
    loan_payments: [
      { id: id("lp"), loan_id: "loan_emergency", date: "2026-06-05", amount: 2500 },
      { id: id("lp"), loan_id: "loan_emergency", date: "2026-07-05", amount: 2500 },
    ],

    pautang: [
      { id: id("pt"), borrower: "Kuya Ben", date_lent: "2026-06-20", amount: 3000, repaid: 1500, notes: "Payday loan" },
      { id: id("pt"), borrower: "Ate Rose", date_lent: "2026-07-02", amount: 1200, repaid: 1200, notes: "Groceries" },
      { id: id("pt"), borrower: "Office pool", date_lent: "2026-07-14", amount: 800, repaid: 0, notes: "Merienda fund" },
    ],

    savings: [
      { id: id("sv"), date: "2026-05-30", account: "BPI Save-Up", deposit: 40000, withdrawal: 0 },
      { id: id("sv"), date: "2026-06-15", account: "BPI Save-Up", deposit: 5000, withdrawal: 0 },
      { id: id("sv"), date: "2026-06-30", account: "BPI Save-Up", deposit: 6000, withdrawal: 0 },
      { id: id("sv"), date: "2026-07-15", account: "BPI Save-Up", deposit: 6500, withdrawal: 0 },
      { id: id("sv"), date: "2026-07-20", account: "BPI Save-Up", deposit: 0, withdrawal: 2000 },
    ],

    habits: [
      { id: "h_gro", name: "Groceries within budget", days: [3, 12, 24] },
      { id: "h_com", name: "Commute (no Grab)", days: [1, 2, 6, 7, 8, 9, 13, 14, 17] },
      { id: "h_cof", name: "Coffee at home", days: [1, 2, 3, 6, 7, 8, 9, 10, 13, 14, 15, 16, 20, 21, 22, 23] },
      { id: "h_gym", name: "Gym", days: [2, 4, 7, 9, 11, 14, 16, 18, 21, 23] },
    ],
  };
}

// Pricing maths for the Coffee library form (loaded by /admin and by the tests).
export const OVERHEAD = 1; // dollars added to the cost of one pour
export const MARKUP = 2;   // x2 = 100% markup

// Whole pours only: 250g bag at 15g per pour is 16 pours, not 16.67.
export const poursPerBag = (bagGrams, pourGrams) => (bagGrams > 0 && pourGrams > 0 ? Math.floor(bagGrams / pourGrams) : 0);

// Bag price in foreign currency / exchange rate (foreign units per S$1) = bag cost in SGD.
export const bagCostSgd = (bagPrice, rate) => (bagPrice > 0 && rate > 0 ? bagPrice / rate : null);

// Cost of one pour in SGD, to the cent. null until every input is usable.
export function costPerPour(bagGrams, pourGrams, bagPrice, rate) {
  const pours = poursPerBag(bagGrams, pourGrams), bag = bagCostSgd(bagPrice, rate);
  return pours > 0 && bag != null ? Math.round((bag / pours) * 100) / 100 : null;
}

// (cost + overhead) x markup, rounded up to a whole dollar. Rounds to cents first so float noise can't bump it up.
export const salesPrice = (cost) => (cost == null || !(cost >= 0) ? null : Math.ceil(Math.round((cost + OVERHEAD) * MARKUP * 100) / 100));

// Chiffres romains (numéros de planches, de sections).
const ROMAN: [number, string][] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];
export function roman(n: number) {
  if (!Number.isFinite(n) || n <= 0) return String(n);
  let out = "";
  let r = Math.floor(n);
  for (const [v, s] of ROMAN) while (r >= v) (out += s), (r -= v);
  return out;
}

// Gas calculations.

const FT3_PER_M3 = 35.3146667214886;
const AIR_MW = 28.9647; // lb/lbmol

// Standard gas-volume conversions. "Standard" here = 60 °F, 14.696 psia.
export const GAS_VOL_UNITS = ['scf', 'Mscf', 'MMscf', 'Bcf', 'Sm3'];

const GAS_VOL_TO_SCF = {
  scf:   1,
  Mscf:  1e3,
  MMscf: 1e6,
  Bcf:   1e9,
  Sm3:   FT3_PER_M3,
};

export function convertGasVolume(value, from, to) {
  const inScf = value * GAS_VOL_TO_SCF[from];
  return inScf / GAS_VOL_TO_SCF[to];
}

// Gas SG (air = 1) -> apparent molecular weight (lb/lbmol)
export function gasSgToMw(gasSg) {
  return AIR_MW * gasSg;
}

export function mwToGasSg(mw) {
  return mw / AIR_MW;
}

// Sutton correlations for pseudo-critical properties of natural gas
// Tpc (°R) = 169.2 + 349.5 γg − 74.0 γg²
// Ppc (psia) = 756.8 − 131.0 γg − 3.6 γg²
export function pseudoCriticals(gasSg) {
  const tpc = 169.2 + 349.5 * gasSg - 74.0 * gasSg * gasSg;
  const ppc = 756.8 - 131.0 * gasSg - 3.6 * gasSg * gasSg;
  return { tpc, ppc };
}

// Brill & Beggs (1974) Z-factor correlation
// Inputs: Tpr (= T/Tpc, both in °R), Ppr (= P/Ppc, both in psia)
// Valid roughly for 1.2 ≤ Tpr ≤ 2.4 and Ppr ≤ 13.
export function zFactorBrillBeggs(tpr, ppr) {
  const A = 1.39 * Math.pow(tpr - 0.92, 0.5) - 0.36 * tpr - 0.101;
  const E = 9 * (tpr - 1);
  const B = (0.62 - 0.23 * tpr) * ppr
          + (0.066 / (tpr - 0.86) - 0.037) * ppr * ppr
          + 0.32 * Math.pow(ppr, 6) / Math.pow(10, E);
  const C = 0.132 - 0.32 * Math.log10(tpr);
  const F = 0.3106 - 0.49 * tpr + 0.1824 * tpr * tpr;
  const D = Math.pow(10, F);
  return A + (1 - A) / Math.exp(B) + C * Math.pow(ppr, D);
}

// Convenience: compute Z directly from gas SG, T(°R), P(psia)
export function zFromConditions(gasSg, tempR, pressurePsia) {
  const { tpc, ppc } = pseudoCriticals(gasSg);
  return zFactorBrillBeggs(tempR / tpc, pressurePsia / ppc);
}

// Real-gas density: ρ (lb/ft³) = P × MW / (Z × R × T)
// R = 10.732 psia·ft³ / (lbmol·°R)
export function gasDensityLbFt3(pressurePsia, gasSg, z, tempR) {
  const mw = gasSgToMw(gasSg);
  return (pressurePsia * mw) / (z * 10.732 * tempR);
}

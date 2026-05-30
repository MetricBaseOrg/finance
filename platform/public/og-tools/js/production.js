// Production / reservoir calculations.

// API gravity ↔ specific gravity (oil, water = 1.0 at 60 °F)
export function apiToSg(api) {
  return 141.5 / (131.5 + api);
}

export function sgToApi(sg) {
  return 141.5 / sg - 131.5;
}

// Gas-Oil Ratio unit conversion
// 1 scf/STB = 0.17810760 Sm³/Sm³
const SCFSTB_TO_SM3SM3 = 0.17810760;

export function gorScfStbToSm3Sm3(scfStb) {
  return scfStb * SCFSTB_TO_SM3SM3;
}

export function gorSm3Sm3ToScfStb(sm3sm3) {
  return sm3sm3 / SCFSTB_TO_SM3SM3;
}

// Standing's correlation for oil formation volume factor (saturated)
// Bo = 0.972 + 1.47e-4 × F^1.175
// F  = Rs × (γg / γo)^0.5 + 1.25 × T(°F)
// Rs in scf/STB, γg = gas SG (air = 1), γo = oil SG (water = 1), T in °F
export function oilFvfStanding(rs, gasSg, oilSg, tempF) {
  const F = rs * Math.sqrt(gasSg / oilSg) + 1.25 * tempF;
  return 0.972 + 1.47e-4 * Math.pow(F, 1.175);
}

// Gas formation volume factor (rcf/scf), simple ideal-corrected form
// Bg = 0.0283 × Z × T(°R) / P(psia)
export function gasFvf(z, tempR, pressurePsia) {
  return 0.0283 * z * tempR / pressurePsia;
}

// Helper: °F -> °R
export function fahrenheitToRankine(f) {
  return f + 459.67;
}

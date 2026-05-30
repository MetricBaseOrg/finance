// Drilling calculations. All inputs/outputs are plain numbers; the UI layer
// handles unit selection and formatting.

// Mud weight conversions. Reference: fresh water = 8.3454 ppg = 1.000 SG.
// 0.052 is the empirical factor for psi/ft from ppg (1 / (12 in/ft × 1/(0.43352…))).
const PPG_TO_SG = 1 / 8.345404452;       // SG from ppg
const PPG_TO_PSIFT = 0.052;              // psi/ft per ppg
const PPG_TO_LBFT3 = 7.4805194805;       // lb/ft³ per ppg (1 ft³ = 7.4805 gal)
const PPG_TO_KGM3 = 119.826427;          // kg/m³ per ppg

export const MUD_UNITS = ['ppg', 'sg', 'lb/ft3', 'kg/m3', 'psi/ft'];

export function mudFromPpg(ppg, target) {
  switch (target) {
    case 'ppg':    return ppg;
    case 'sg':     return ppg * PPG_TO_SG;
    case 'lb/ft3': return ppg * PPG_TO_LBFT3;
    case 'kg/m3':  return ppg * PPG_TO_KGM3;
    case 'psi/ft': return ppg * PPG_TO_PSIFT;
    default: throw new Error(`Unknown mud weight unit: ${target}`);
  }
}

export function mudToPpg(value, source) {
  switch (source) {
    case 'ppg':    return value;
    case 'sg':     return value / PPG_TO_SG;
    case 'lb/ft3': return value / PPG_TO_LBFT3;
    case 'kg/m3':  return value / PPG_TO_KGM3;
    case 'psi/ft': return value / PPG_TO_PSIFT;
    default: throw new Error(`Unknown mud weight unit: ${source}`);
  }
}

export function convertMudWeight(value, from, to) {
  return mudFromPpg(mudToPpg(value, from), to);
}

// Hydrostatic pressure
// Field: P(psi) = MW(ppg) × TVD(ft) × 0.052
export function hydrostaticPsi(mwPpg, tvdFt) {
  return mwPpg * tvdFt * PPG_TO_PSIFT;
}

// SI: P(kPa) = MW(kg/m³) × TVD(m) × g / 1000
export function hydrostaticKpa(mwKgM3, tvdM) {
  const g = 9.80665;
  return mwKgM3 * tvdM * g / 1000;
}

// Pipe & annular capacity (bbl/ft) using API factor 1029.4 for ID in inches.
export function pipeCapacityBblFt(idIn) {
  return (idIn * idIn) / 1029.4;
}

export function annularCapacityBblFt(holeDiaIn, pipeOdIn) {
  return (holeDiaIn * holeDiaIn - pipeOdIn * pipeOdIn) / 1029.4;
}

// Volume = capacity × length
export function pipeVolumeBbl(idIn, lengthFt) {
  return pipeCapacityBblFt(idIn) * lengthFt;
}

export function annularVolumeBbl(holeDiaIn, pipeOdIn, lengthFt) {
  return annularCapacityBblFt(holeDiaIn, pipeOdIn) * lengthFt;
}

// Equivalent Circulating Density
// ECD(ppg) = MW(ppg) + APL(psi) / (0.052 × TVD(ft))
export function ecdPpg(mwPpg, annularPressureLossPsi, tvdFt) {
  return mwPpg + annularPressureLossPsi / (PPG_TO_PSIFT * tvdFt);
}

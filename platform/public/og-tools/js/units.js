// Unit registry. Each category is a map of unit-id -> { name, toBase, fromBase }.
// "Base" is an arbitrary canonical unit per category; conversions go via the base.

export const UNITS = {
  volume: {
    base: 'm3',
    units: {
      m3:   { name: 'cubic meter (m³)',   toBase: v => v,                fromBase: v => v },
      L:    { name: 'liter (L)',          toBase: v => v / 1000,         fromBase: v => v * 1000 },
      bbl:  { name: 'oil barrel (bbl)',   toBase: v => v * 0.158987294928, fromBase: v => v / 0.158987294928 },
      galUS:{ name: 'US gallon (gal)',    toBase: v => v * 0.003785411784, fromBase: v => v / 0.003785411784 },
      ft3:  { name: 'cubic foot (ft³)',   toBase: v => v * 0.028316846592, fromBase: v => v / 0.028316846592 },
      in3:  { name: 'cubic inch (in³)',   toBase: v => v * 1.6387064e-5,   fromBase: v => v / 1.6387064e-5 },
    },
  },

  pressure: {
    base: 'Pa',
    units: {
      Pa:     { name: 'pascal (Pa)',         toBase: v => v,            fromBase: v => v },
      kPa:    { name: 'kilopascal (kPa)',    toBase: v => v * 1000,     fromBase: v => v / 1000 },
      MPa:    { name: 'megapascal (MPa)',    toBase: v => v * 1e6,      fromBase: v => v / 1e6 },
      bar:    { name: 'bar',                 toBase: v => v * 1e5,      fromBase: v => v / 1e5 },
      psi:    { name: 'psi',                 toBase: v => v * 6894.757293168, fromBase: v => v / 6894.757293168 },
      atm:    { name: 'atmosphere (atm)',    toBase: v => v * 101325,   fromBase: v => v / 101325 },
      kgcm2:  { name: 'kg/cm²',              toBase: v => v * 98066.5,  fromBase: v => v / 98066.5 },
    },
  },

  // Temperature uses offsets too — handled via toBase/fromBase like everything else.
  temperature: {
    base: 'K',
    units: {
      K:  { name: 'kelvin (K)',     toBase: v => v,                       fromBase: v => v },
      C:  { name: 'celsius (°C)',   toBase: v => v + 273.15,              fromBase: v => v - 273.15 },
      F:  { name: 'fahrenheit (°F)',toBase: v => (v - 32) * 5/9 + 273.15, fromBase: v => (v - 273.15) * 9/5 + 32 },
      R:  { name: 'rankine (°R)',   toBase: v => v * 5/9,                 fromBase: v => v * 9/5 },
    },
  },

  length: {
    base: 'm',
    units: {
      m:  { name: 'meter (m)',     toBase: v => v,            fromBase: v => v },
      km: { name: 'kilometer (km)',toBase: v => v * 1000,     fromBase: v => v / 1000 },
      cm: { name: 'centimeter (cm)',toBase: v => v / 100,     fromBase: v => v * 100 },
      mm: { name: 'millimeter (mm)',toBase: v => v / 1000,    fromBase: v => v * 1000 },
      in: { name: 'inch (in)',     toBase: v => v * 0.0254,   fromBase: v => v / 0.0254 },
      ft: { name: 'foot (ft)',     toBase: v => v * 0.3048,   fromBase: v => v / 0.3048 },
      yd: { name: 'yard (yd)',     toBase: v => v * 0.9144,   fromBase: v => v / 0.9144 },
      mi: { name: 'mile (mi)',     toBase: v => v * 1609.344, fromBase: v => v / 1609.344 },
    },
  },

  mass: {
    base: 'kg',
    units: {
      kg:    { name: 'kilogram (kg)',    toBase: v => v,             fromBase: v => v },
      g:     { name: 'gram (g)',         toBase: v => v / 1000,      fromBase: v => v * 1000 },
      tonne: { name: 'metric ton (t)',   toBase: v => v * 1000,      fromBase: v => v / 1000 },
      lb:    { name: 'pound (lb)',       toBase: v => v * 0.45359237,fromBase: v => v / 0.45359237 },
      oz:    { name: 'ounce (oz)',       toBase: v => v * 0.028349523125, fromBase: v => v / 0.028349523125 },
      tonUS: { name: 'short ton (US)',   toBase: v => v * 907.18474, fromBase: v => v / 907.18474 },
    },
  },

  // Flow rate base is m³/s. scf/d uses standard cubic feet (no Z, just volume conversion).
  flowRate: {
    base: 'm3s',
    units: {
      m3s:    { name: 'm³/s',         toBase: v => v,                           fromBase: v => v },
      m3d:    { name: 'm³/day',       toBase: v => v / 86400,                   fromBase: v => v * 86400 },
      bbld:   { name: 'bbl/day',      toBase: v => v * 0.158987294928 / 86400,  fromBase: v => v * 86400 / 0.158987294928 },
      gpm:    { name: 'US gpm',       toBase: v => v * 0.003785411784 / 60,     fromBase: v => v * 60 / 0.003785411784 },
      Lpm:    { name: 'L/min',        toBase: v => v / 1000 / 60,               fromBase: v => v * 60000 },
      scfd:   { name: 'scf/day',      toBase: v => v * 0.028316846592 / 86400,  fromBase: v => v * 86400 / 0.028316846592 },
      Mscfd:  { name: 'Mscf/day (10³)', toBase: v => v * 1000 * 0.028316846592 / 86400, fromBase: v => v * 86400 / (1000 * 0.028316846592) },
      MMscfd: { name: 'MMscf/day (10⁶)', toBase: v => v * 1e6 * 0.028316846592 / 86400, fromBase: v => v * 86400 / (1e6 * 0.028316846592) },
    },
  },
};

export function convert(category, value, fromUnit, toUnit) {
  const cat = UNITS[category];
  if (!cat) throw new Error(`Unknown category: ${category}`);
  const from = cat.units[fromUnit];
  const to = cat.units[toUnit];
  if (!from || !to) throw new Error(`Unknown unit in ${category}`);
  return to.fromBase(from.toBase(value));
}

export function unitOptions(category) {
  return Object.entries(UNITS[category].units).map(([id, u]) => ({ id, name: u.name }));
}

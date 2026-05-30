// Thin wrapper around the unit registry. Kept as its own module so the UI layer
// imports a stable surface even if the registry shape changes later.

import { UNITS, convert as registryConvert, unitOptions } from './units.js';

export function convert(category, value, fromUnit, toUnit) {
  return registryConvert(category, value, fromUnit, toUnit);
}

export function listCategories() {
  return Object.keys(UNITS).map(id => ({
    id,
    label: CATEGORY_LABELS[id] ?? id,
  }));
}

export function listUnits(category) {
  return unitOptions(category);
}

const CATEGORY_LABELS = {
  volume: 'Volume',
  pressure: 'Pressure',
  temperature: 'Temperature',
  length: 'Length',
  mass: 'Mass',
  flowRate: 'Flow rate',
};

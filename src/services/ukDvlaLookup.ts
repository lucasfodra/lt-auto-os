import { UK_VEHICLE_SPECS_DB, UkVehicleTechnicalSpec } from '../data/ukVehicleDatabase';

/**
 * Decodes a UK Registration Plate (VRM) age identifier (e.g. SH64 WRF -> 2014/2015, SO18 XZP -> 2018)
 * and matches against the local Scottish/UK Vehicle Technical Spec Database.
 */
export function decodeUkPlateYear(vrm: string): { year: number | null; isScottishRegistered: boolean } {
  const clean = vrm.replace(/\s+/g, '').toUpperCase();
  const isScottishRegistered = /^S[A-Z][0-9]{2}/.test(clean);
  const match = clean.match(/^[A-Z]{2}([0-9]{2})[A-Z]{3}$/);

  if (!match) {
    return { year: null, isScottishRegistered };
  }

  const ageCode = parseInt(match[1], 10);
  if (ageCode >= 51 && ageCode <= 99) {
    // September release (e.g. 64 = late 2014 / early 2015)
    return { year: 2000 + (ageCode - 50), isScottishRegistered };
  }
  if (ageCode >= 2 && ageCode <= 49) {
    // March release (e.g. 18 = 2018)
    return { year: 2000 + ageCode, isScottishRegistered };
  }

  return { year: null, isScottishRegistered };
}

export function searchUkVehicleDatabase(query: string): UkVehicleTechnicalSpec[] {
  const q = query.trim().toLowerCase();
  if (!q) return UK_VEHICLE_SPECS_DB;
  return UK_VEHICLE_SPECS_DB.filter(
    (spec) =>
      spec.make.toLowerCase().includes(q) ||
      spec.model.toLowerCase().includes(q) ||
      spec.engineLabel.toLowerCase().includes(q) ||
      spec.engineCode.toLowerCase().includes(q) ||
      spec.oilOemSpec.toLowerCase().includes(q)
  );
}

export class GetEnergyCostDto {
  start_date: string;
  end_date: string;
  meterIds?: string[];      // Optional if using area
  suffixes: string[];
  area?: string;            // NEW: Area (e.g., Unit_4)
}

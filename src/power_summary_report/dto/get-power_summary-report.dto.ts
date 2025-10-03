export class GetEnergyCostDto {
  start_time?: string; // optional "06:00"
  end_time?: string;   // optional "18:30"
  start_date: string;
  end_date: string;
  meterIds?: string[];      // Optional if using area
  suffixes: string[];
  area?: string;            // NEW: Area (e.g., Unit_4)
}

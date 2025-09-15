export class GetEnergyCostDto {
  start_date: string;  // "2025-09-10"
  end_date: string;    // "2025-09-12"
  start_time?: string; // optional "06:00"
  end_time?: string;   // optional "18:30"
  area?: string;
  meterIds?: string[];
  suffixes: string[];
}

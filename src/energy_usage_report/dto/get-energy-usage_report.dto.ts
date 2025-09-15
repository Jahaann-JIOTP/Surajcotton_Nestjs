export class GetEnergyCostDto {
  start_date: string;
  end_date: string;
  start_time?: string; // optional "06:00"
  end_time?: string;   // optional "18:30"
  suffixes: string[];
  area: string;
  department?: string;
  meterIds?: string[];
}

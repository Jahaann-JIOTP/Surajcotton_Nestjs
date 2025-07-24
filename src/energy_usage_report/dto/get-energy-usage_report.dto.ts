export class GetEnergyCostDto {
  start_date: string;
  end_date: string;
  suffixes: string[];
  area: string;
  department?: string;
  meterIds?: string[];
}

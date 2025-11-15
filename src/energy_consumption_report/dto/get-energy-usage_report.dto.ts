export class GetEnergyCostDto {
  start_date: string;
  end_date: string;

  start_time: string = "06:00";   // default
  end_time: string = "06:05";     // default

   suffixes: string[] = ["Del_ActiveEnergy"];        // default
  area: string = "ALL";           // default

  department?: string;
  meterIds: string[] = [];        // default
}



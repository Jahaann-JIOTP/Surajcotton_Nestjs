export class ConsumptionDto {
  department: string;
  meters: string[];
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  startTime: string; // HH:mm:ss (default "06:00:00")
  endTime: string;   // HH:mm:ss (default "06:00:00")
}

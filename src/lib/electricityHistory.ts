export const filterElectricityHistoryLogs = (
  logs: Array<any>,
  roomFilter: string,
  startDate: string,
  endDate: string,
) => {
  const normalizedRoom = roomFilter.trim().toLowerCase();

  return logs.filter((log: any) => {
    const meterName = (log.electricity_meters?.meter_name || '').toLowerCase();
    const locationCode = (log.electricity_meters?.location_code || '').toLowerCase();
    const roomMatch = !normalizedRoom || meterName.includes(normalizedRoom) || locationCode.includes(normalizedRoom);

    if (!roomMatch) return false;

    if (!startDate && !endDate) return true;

    const logDate = new Date(log.created_at).toISOString().split('T')[0];
    if (startDate && logDate < startDate) return false;
    if (endDate && logDate > endDate) return false;
    return true;
  });
};

const isLocationCodeLike = (value: string) => /^[a-z0-9._-]+$/i.test(value.trim()) && value.trim().length <= 12;

export const getElectricityHistoryRoomOptions = (logs: Array<any>) => {
  const values = new Set<string>();

  logs.forEach((log: any) => {
    const meterName = log.electricity_meters?.meter_name || '';
    const locationCode = log.electricity_meters?.location_code || '';

    if (meterName) values.add(meterName);
    if (locationCode) values.add(locationCode);
  });

  return Array.from(values).sort((a, b) => {
    const aIsCode = isLocationCodeLike(a);
    const bIsCode = isLocationCodeLike(b);
    if (aIsCode !== bIsCode) return aIsCode ? -1 : 1;
    return a.localeCompare(b, 'th', { sensitivity: 'base' });
  });
};

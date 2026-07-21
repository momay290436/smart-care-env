import { describe, expect, it } from 'vitest';
import { filterElectricityHistoryLogs, getElectricityHistoryRoomOptions } from './electricityHistory';

describe('electricity history filters', () => {
  it('filters logs by room name or location code with partial text', () => {
    const logs = [
      {
        id: '1',
        created_at: '2026-07-01T10:00:00.000Z',
        electricity_meters: { meter_name: 'ห้องตรวจ 101', location_code: 'A101' },
      },
      {
        id: '2',
        created_at: '2026-07-02T10:00:00.000Z',
        electricity_meters: { meter_name: 'ห้องพัก 202', location_code: 'B202' },
      },
    ];

    const result = filterElectricityHistoryLogs(logs, '101', '', '');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('builds room options from meter names and location codes', () => {
    const logs = [
      {
        id: '1',
        created_at: '2026-07-01T10:00:00.000Z',
        electricity_meters: { meter_name: 'ห้องตรวจ 101', location_code: 'A101' },
      },
      {
        id: '2',
        created_at: '2026-07-02T10:00:00.000Z',
        electricity_meters: { meter_name: 'ห้องพัก 202', location_code: 'B202' },
      },
    ];

    expect(getElectricityHistoryRoomOptions(logs)).toEqual(['A101', 'B202', 'ห้องตรวจ 101', 'ห้องพัก 202']);
  });
});

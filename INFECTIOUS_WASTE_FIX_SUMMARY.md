# Infectious Waste Data Integration - Fix Summary

## Problem Statement
The Dashboard was not displaying historical infectious waste data that was previously recorded in the `infectious_waste_records` table. After consolidating the waste logging forms, the system used only the new `waste_logs` table for calculations, leaving old data invisible on the dashboard.

## Root Cause
- Two separate tables store infectious waste data:
  - **waste_logs** (new): waste_type='infectious', weight field
  - **infectious_waste_records** (old): sharp_waste_kg + non_sharp_waste_kg fields with collection_date
- Dashboard queries only fetched from `waste_logs` table
- Old data in `infectious_waste_records` was never included in any calculations

## Solution Implemented

### 1. Dashboard.tsx - Updated Waste History Query (Lines 102-124)
**File:** `src/pages/Dashboard.tsx`

**Changes:**
- Fetch waste_logs (all types)
- Fetch infectious_waste_records from old system
- Transform old records to match waste_logs structure:
  - weight = sharp_waste_kg + non_sharp_waste_kg (summed)
  - waste_type = 'infectious'
  - created_at = collection_date
- Combine both datasets
- Sort by created_at for chronological order

**Impact:** 
- Waste forecasting now includes historical data
- More accurate trend analysis over time

### 2. Dashboard.tsx - Updated Waste Data Query (Lines 247-282)
**File:** `src/pages/Dashboard.tsx`

**Changes:**
- Fetch waste_logs filtered by date range
- Fetch infectious_waste_records filtered by date range
  - Converts ISO timestamps to date format for comparison
  - Uses `collection_date` for filtering
- Transform old records to match waste_logs structure
- Combine all data before calculations
- Calculate metrics (byType, byDay, total) from combined dataset

**Impact:**
- Dashboard cards (ขยะติดเชื้อ) show complete totals
- Charts display accurate trends including historical data
- Cost calculations include old data via WASTE_FORECAST_COST_PER_KG['infectious'] = 15 ฿/kg

### 3. WasteLog.tsx - Updated Cache Invalidation (Lines 186-188, 203-206)
**File:** `src/pages/WasteLog.tsx`

**Changes:**
- Added invalidation for Dashboard query keys:
  - `["waste-history"]`
  - `["waste-filtered"]`
- Ensures Dashboard automatically refreshes when:
  - New waste data is saved
  - Old waste data is deleted

**Impact:**
- Dashboard stays in sync with latest data
- Real-time updates when users save/delete records

## Data Mapping

### Old Table Structure (infectious_waste_records)
```sql
- id: UUID
- collection_date: DATE
- transfer_date: DATE (optional)
- health_center_name: TEXT
- sharp_waste_kg: NUMERIC
- non_sharp_waste_kg: NUMERIC
- delivered_by: TEXT
- recorded_by: UUID
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### New Table Structure (waste_logs)
```sql
- id: UUID
- waste_type: TEXT ('general', 'infectious', 'hazardous', 'recycle')
- weight: NUMERIC
- department_id: UUID
- recorded_by: UUID
- created_at: TIMESTAMP
```

### Mapping Logic
```
old.sharp_waste_kg + old.non_sharp_waste_kg → new.weight
old.collection_date → new.created_at (for grouping)
'infectious' → waste_type (constant)
```

## Dashboard Calculations Now Include

### Weight Summary Card (Red Card)
- Total infectious waste weight = old_records_total + waste_logs_total
- Format: `{wasteData.total} กก.`

### Waste Proportion Chart (Pie Chart)
- Shows breakdown by waste type
- Infectious weight includes:
  - New entries from waste_logs
  - Historical entries from infectious_waste_records

### Daily Trend Chart (Area Chart)
- X-axis: dates from both old and new records
- Y-axis: weight (kg)
- Stacked areas for each waste type
- Historical data visible in older dates

### Waste Forecast
- Includes all historical infectious waste data
- More accurate monthly totals
- Better forecasting with complete historical context
- Cost calculation: `forecastTotal × 15 ฿/kg`

## Testing Checklist

- [ ] Verify Dashboard displays infectious waste data
- [ ] Check that old records from infectious_waste_records appear
- [ ] Confirm waste summary card shows combined total
- [ ] Verify trend chart includes historical data points
- [ ] Test that new waste log entries update Dashboard
- [ ] Confirm deletion of old records updates Dashboard
- [ ] Check forecast calculations use combined data
- [ ] Verify cost calculations are accurate (15 ฿/kg × total)

## Query Performance Notes

- Both queries now fetch from 2 tables instead of 1
- Limit of 1000 records per table (for wasteHistory)
- Date range filtering applied to infectious_waste_records
- Data combining happens client-side (acceptable volume)
- Consider index on infectious_waste_records.collection_date for large datasets

## Files Modified

1. **src/pages/Dashboard.tsx**
   - Updated wasteHistory query
   - Updated wasteData query
   - No UI/logic changes needed

2. **src/pages/WasteLog.tsx**
   - Added cache invalidation for Dashboard queries
   - No UI/logic changes needed

## Backward Compatibility

✓ No breaking changes
✓ Old data structure intact
✓ New waste_logs table continues to work as before
✓ Existing UI components work with combined data
✓ Query keys changed for Dashboard but isolated to those queries

## Future Improvements

1. Consider creating a database view that UNIONs both tables for simplicity
2. Add migration script to archive old infectious_waste_records
3. Add data validation to ensure consistency between tables
4. Consider consolidating data into single table after historical period expires

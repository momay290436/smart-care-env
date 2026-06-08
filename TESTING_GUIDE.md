# Testing & Verification Guide - Infectious Waste Data Integration

## Pre-Test Requirements

1. **Database State**
   - Ensure infectious_waste_records table has sample data
   - Ensure waste_logs table has recent entries
   - Verify both tables are accessible

2. **Application State**
   - Clear browser cache to force new queries
   - Recent build of the application
   - User logged in with appropriate permissions

## Test Cases

### Test 1: Historical Data Display
**Objective:** Verify that old infectious waste records are displayed on Dashboard

**Steps:**
1. Navigate to Dashboard page
2. Check "น้ำหนักขยะ" (Waste Weight) section
3. Click filter button "รายเดือน" (This Month)

**Expected Results:**
- Card shows total weight > 0 if old data exists
- Weight should include data from infectious_waste_records
- Format: "XXXX กก." (weight in kg)

**Verification Query:**
```sql
SELECT SUM(sharp_waste_kg + non_sharp_waste_kg) as total_old_waste
FROM infectious_waste_records
WHERE collection_date >= DATE_TRUNC('month', NOW())::date;
```

---

### Test 2: Weight Calculation Accuracy
**Objective:** Verify that old records' weights are calculated correctly

**Steps:**
1. Go to Dashboard "น้ำหนักขยะ" section
2. Note the total weight displayed
3. Check the pie chart - infectious waste portion

**Expected Results:**
- Total = (new waste_logs infectious weight) + (old infectious_waste_records weight)
- Old weight = SUM(sharp_waste_kg + non_sharp_waste_kg)
- Both values included in the total

**Manual Verification:**
```
Old: SELECT SUM(sharp_waste_kg + non_sharp_waste_kg) FROM infectious_waste_records
New: SELECT SUM(weight) FROM waste_logs WHERE waste_type='infectious'
Dashboard Total should = Old + New
```

---

### Test 3: Date Range Filtering
**Objective:** Verify that old records are correctly filtered by date range

**Steps:**
1. Go to Dashboard "น้ำหนักขยะ" section
2. Click "เลือกช่วง" (Custom Date Range)
3. Select date range that includes old records
4. Note the displayed weight
5. Change to different date range
6. Verify weight updates correctly

**Expected Results:**
- Weight changes when date range changes
- Old records filtered correctly by collection_date
- New records filtered correctly by created_at

**Edge Cases to Test:**
- Date range with only old records (should show old data)
- Date range with only new records (should show new data)
- Date range with both old and new (should show combined)
- Date range with no records (should show 0)

---

### Test 4: Trend Chart Accuracy
**Objective:** Verify that trend chart includes both old and new data

**Steps:**
1. Go to Dashboard "น้ำหนักขยะ" section
2. Observe "แนวโน้มรายวัน" (Daily Trend) chart
3. Look for data points from older dates (from infectious_waste_records)

**Expected Results:**
- Chart shows data across date range
- Old records appear on dates they were recorded
- New records appear on dates they were created
- Both types appear as continuous line/area

---

### Test 5: Forecast Including Historical Data
**Objective:** Verify that forecasts use complete historical data

**Steps:**
1. Scroll down to "พยากรณ์ขยะ" (Waste Forecast) section
2. Select "ขยะติดเชื้อ" (Infectious Waste) from dropdown
3. Observe the forecast amount and cost

**Expected Results:**
- Forecast calculation uses all available data
- More accurate because it includes old records
- Cost = Forecast Amount × 15 ฿/kg

**Verification:**
- Cost should be reasonably proportional to forecast amount
- 15 ฿/kg rate should be applied to total

---

### Test 6: Real-time Updates
**Objective:** Verify that Dashboard updates when new data is saved

**Steps:**
1. Open Dashboard in one browser tab
2. Open WasteLog in another browser tab
3. Record new infectious waste entry in WasteLog
4. Switch back to Dashboard tab
5. Wait 2-3 seconds and observe if data updates

**Expected Results:**
- Dashboard weight updates automatically
- Charts refresh with new data
- No page refresh needed (automatic via query cache)

---

### Test 7: Data Consistency
**Objective:** Verify that combined data is consistent and accurate

**Steps:**
1. Query database directly for both tables:
   ```sql
   SELECT SUM(weight) FROM waste_logs WHERE waste_type='infectious';
   SELECT SUM(sharp_waste_kg + non_sharp_waste_kg) FROM infectious_waste_records;
   ```
2. Compare with Dashboard total
3. Verify they match

**Expected Results:**
- Dashboard total = Database old total + Database new total
- No data loss or duplication
- Calculations are mathematically correct

---

### Test 8: NULL Values Handling
**Objective:** Verify that NULL values in weight fields are handled correctly

**Steps:**
1. Verify database has records with NULL weights
2. Check that Dashboard doesn't show errors
3. Verify calculations are still correct

**Expected Results:**
- NULL values default to 0 (per query: `Number(r.sharp_waste_kg || 0)`)
- No console errors
- Calculations ignore NULL values

---

### Test 9: Sorting and Ordering
**Objective:** Verify that data is properly sorted by date

**Steps:**
1. Check trend chart x-axis labels
2. Verify dates are in chronological order
3. Check that old records appear before new records (if dates warrant)

**Expected Results:**
- Data points sorted chronologically
- Dates displayed in correct order
- No gaps or jumps in timeline

---

### Test 10: Performance Check
**Objective:** Verify that queries don't cause performance issues

**Steps:**
1. Open Developer Tools (F12)
2. Go to Network tab
3. Navigate to Dashboard
4. Monitor query load time
5. Check console for errors

**Expected Results:**
- Queries complete within reasonable time (< 2 seconds)
- No errors in console
- No UI freezing or lag

**Browser DevTools Check:**
- Expand network request for waste data
- Verify response time is acceptable
- Check response payload size (should be reasonable)

---

## Debugging Tips

### If Data is Not Showing:

1. **Check Database Connection**
   ```
   - Verify Supabase connection is working
   - Check browser console for API errors
   - Verify RLS policies allow SELECT on both tables
   ```

2. **Check Query Results**
   ```
   - Open browser console (F12)
   - The queries will appear in the Application/Network tab
   - Look for errors in the response
   ```

3. **Check Data Exists**
   ```sql
   SELECT COUNT(*) FROM waste_logs WHERE waste_type='infectious';
   SELECT COUNT(*) FROM infectious_waste_records;
   ```

### If Calculations Are Wrong:

1. **Verify Old Data Transformation**
   ```
   - Check that sharp_waste_kg + non_sharp_waste_kg = displayed weight
   - Look for rounding issues
   - Verify date format conversion
   ```

2. **Verify Combined Totals**
   ```
   - Manually calculate old + new
   - Compare with Dashboard display
   - Check for missing records
   ```

### If Updates Aren't Reflecting:

1. **Check Query Cache**
   - Clear browser cache
   - Close and reopen Dashboard
   - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

2. **Check Cache Invalidation**
   - Verify queryClient.invalidateQueries() is called
   - Check browser console for any errors
   - Monitor network for new query request

---

## SQL Queries for Manual Verification

### Total Infectious Waste (Old Records)
```sql
SELECT 
  ROUND(SUM(COALESCE(sharp_waste_kg, 0) + COALESCE(non_sharp_waste_kg, 0))::numeric, 2) as total_weight
FROM infectious_waste_records;
```

### Total Infectious Waste (New Records)
```sql
SELECT 
  ROUND(SUM(weight)::numeric, 2) as total_weight
FROM waste_logs
WHERE waste_type = 'infectious';
```

### Combined Total (Expected Dashboard Value)
```sql
SELECT 
  ROUND(
    (SELECT COALESCE(SUM(COALESCE(sharp_waste_kg, 0) + COALESCE(non_sharp_waste_kg, 0)), 0) 
     FROM infectious_waste_records) +
    (SELECT COALESCE(SUM(weight), 0) 
     FROM waste_logs 
     WHERE waste_type = 'infectious')
  , 2) as combined_total;
```

### Monthly Breakdown
```sql
SELECT 
  DATE_TRUNC('month', collection_date)::date as month,
  ROUND(SUM(COALESCE(sharp_waste_kg, 0) + COALESCE(non_sharp_waste_kg, 0))::numeric, 2) as old_weight
FROM infectious_waste_records
GROUP BY DATE_TRUNC('month', collection_date)
ORDER BY month DESC;
```

---

## Success Criteria

✓ All test cases pass
✓ Dashboard displays combined old and new data
✓ Calculations are mathematically accurate
✓ No console errors
✓ Performance is acceptable
✓ Real-time updates work correctly
✓ Date filtering works as expected
✓ Historical trends are visible in charts

## Sign-off

After completing all tests and verifying success criteria:

- [ ] Dashboard displays infectious waste data correctly
- [ ] Old records from infectious_waste_records are included
- [ ] Calculations include both old and new data
- [ ] Performance is acceptable
- [ ] No errors or warnings in console
- [ ] Ready for production deployment

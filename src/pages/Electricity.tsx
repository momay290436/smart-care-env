// ส่งออกไฟล์รายงานสรุปแยกหมวดหมู่ตามวงเล็บท้ายชื่อ
  const exportExcel = () => {
    const formatLogItem = (log: any) => ({
      'วัน-เวลาที่จด': new Date(log.created_at).toLocaleString('th-TH'),
      'สถานที่ติดตั้ง': log.electricity_meters?.meter_name || 'ไม่พบข้อมูล',
      'เลขมิเตอร์ไฟครั้งก่อน': log.previous_value,
      'เลขมิเตอร์ไฟล่าสุด': log.current_value,
      'จำนวนหน่วยไฟที่ใช้ประจำงวด (หน่วย)': log.units_used,
      'เลขมิเตอร์น้ำครั้งก่อน': log.previous_water_value || '-',
      'เลขมิเตอร์น้ำล่าสุด': log.current_water_value || '-',
      'จำนวนหน่วยน้ำที่ใช้ประจำงวด (หน่วย)': log.current_water_value && log.previous_water_value ? (log.current_water_value - log.previous_water_value) : '-'
    });

    const categories = [
      { key: 'ร้านค้า', label: 'ร้านค้า' },
      { key: 'บ้านพัก', label: 'บ้านพัก' },
      { key: 'แฟลต1', label: 'แฟลต1' },
      { key: 'แฟลต2', label: 'แฟลต2' },
      { key: 'แฟลต3', label: 'แฟลต3' },
      { key: 'แฟลต4', label: 'แฟลต4' }
    ];

    const wb = XLSX.utils.book_new();

    // 1. แผ่นงานรวมทุกสถานที่
    const allRecords = filteredLogs.map(formatLogItem);
    const wsAll = XLSX.utils.json_to_sheet(allRecords);
    XLSX.utils.book_append_sheet(wb, wsAll, "รวมทุกสถานที่");

    // 2. แผ่นงานแยกตามหมวดหมู่หลักที่มีวงเล็บ
    categories.forEach(category => {
      const filtered = filteredLogs.filter((log: any) => {
        const name = log.electricity_meters?.meter_name || '';
        return name.includes(`(${category.key})`);
      });

      const filteredRecords = filtered.map(formatLogItem);
      const wsFiltered = XLSX.utils.json_to_sheet(filteredRecords);
      XLSX.utils.book_append_sheet(wb, wsFiltered, category.label);
    });

    // 3. แผ่นงาน "อื่นๆ" สำหรับสถานที่ที่ไม่ตรงกับวงเล็บประเภทใดๆ เลย (หรือไม่มีวงเล็บ)
    const othersFiltered = filteredLogs.filter((log: any) => {
      const name = log.electricity_meters?.meter_name || '';
      // ตรวจสอบว่าชื่อสถานที่นี้ ไม่มีคำใดๆ ในหมวดหมู่ categories อยู่เลย
      const hasMainCategory = categories.some(category => name.includes(`(${category.key})`));
      return !hasMainCategory;
    });

    const othersRecords = othersFiltered.map(formatLogItem);
    const wsOthers = XLSX.utils.json_to_sheet(othersRecords);
    XLSX.utils.book_append_sheet(wb, wsOthers, "อื่นๆ");

    XLSX.writeFile(wb, "Meter_Comprehensive_Report.xlsx");
  };

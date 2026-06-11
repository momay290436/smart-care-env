// 2. คำนวณยอด KPI สรุปของเดือนปัจจุบัน (รองรับการแปลงรูปแบบเวลาไทย/สากล ปี 2026 อย่างแม่นยำ)
  const currentMonthStats = React.useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear(); // ปี ค.ศ. ปัจจุบัน (เช่น 2026)
    const currentMonth = now.getMonth();    // เดือนปัจจุบัน (0-11)

    let totalElectricUnits = 0;
    let totalWaterUnits = 0;

    logs.forEach((log: any) => {
      if (!log.created_at) return;
      
      const logDate = new Date(log.created_at);
      let logYear = logDate.getFullYear();
      
      // ป้องกันกรณีบาง Browser แปลงวันที่ระบบพ.ศ. ทะลุไปปี 2569 ให้หักลบกลับมาเป็น ค.ศ. เพื่อเทียบค่า
      if (logYear > 2500) {
        logYear = logYear - 543;
      }

      // ตรวจสอบเงื่อนไขว่าอยู่ในเดือนและปีปัจจุบันตรงกันหรือไม่
      if (logYear === currentYear && logDate.getMonth() === currentMonth) {
        
        // ⚡️ รวมหน่วยไฟฟ้าประจำเดือน
        const electricUnits = parseFloat(log.units_used);
        if (!isNaN(electricUnits)) {
          totalElectricUnits += electricUnits;
        }
        
        // 💧 รวมหน่วยค่าน้ำประปาประจำเดือน (แปลงจากข้อความให้กลายเป็นตัวเลขก่อนคำนวณ)
        if (log.current_water_value !== undefined && log.current_water_value !== null && log.current_water_value !== '-') {
          const currentWater = parseFloat(log.current_water_value);
          const previousWater = parseFloat(log.previous_water_value || 0);

          if (!isNaN(currentWater) && !isNaN(previousWater)) {
            const waterDiff = currentWater - previousWater;
            // บันทึกเฉพาะแถวที่มีการกดใช้น้ำจริง (ผลต่างต้องมากกว่า 0)
            if (waterDiff > 0) {
              totalWaterUnits += waterDiff;
            }
          }
        }

      }
    });

    return {
      electric: totalElectricUnits.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 }),
      water: totalWaterUnits.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 }),
      monthName: now.toLocaleString('th-TH', { month: 'long', year: 'numeric' })
    };
  }, [logs]);

const handleExport = () => {
    if (filteredLogs.length === 0) {
      toast.error("ไม่มีข้อมูลที่จะส่งออกในตารางนี้");
      return;
    }

    // 1. โครงสร้างข้อมูลสำหรับนำออก Excel (ใช้ตามแบบฉบับเดิมของคุณ)
    const dataToExport = filteredLogs.map((log) => ({
      "วันที่-เวลา": format(new Date(log.collected_at), "dd MMM yyyy HH:mm", { locale: th }),
      "แหล่งที่มา / แผนก": log.source_name || "ไม่ระบุ",
      "ประเภทขยะ": typesMap[log.waste_type]?.label || log.waste_type,
      "น้ำหนัก (กก.)": Number(log.weight),
      "หมายเหตุ": log.note || "-",
    }));

    // 2. สร้างเล่มสมุดงาน Excel (Workbook) ใหม่
    const wb = XLSX.utils.book_new();

    // 3. แผ่นงานแรก: รวมทุกแหล่งที่มา (เอาข้อมูลรวมใส่ชีทแรกตามที่คุณต้องการ)
    const wsAll = XLSX.utils.json_to_sheet(dataToExport);
    XLSX.utils.book_append_sheet(wb, wsAll, "รวมทุกแหล่งที่มา");

    // 4. แผ่นงานถัดไป: แยกชีทตามสถานที่/แหล่งที่มาอัตโนมัติ
    // ดึงรายชื่อแหล่งที่มาที่ไม่ซ้ำกันออกมา
    const uniqueSources = Array.from(
      new Set(filteredLogs.map((log) => log.source_name).filter(Boolean))
    );

    // วนลูปสร้างชีทแยกให้แต่ละสถานที่
    uniqueSources.forEach((sourceName) => {
      // กรองเอาเฉพาะข้อมูลของสถานที่นั้นๆ
      const sourceLogs = filteredLogs.filter((log) => log.source_name === sourceName);
      
      // แปลงข้อมูลให้อยู่ในรูปแบบ Excel
      const sourceDataToExport = sourceLogs.map((log) => ({
        "วันที่-เวลา": format(new Date(log.collected_at), "dd MMM yyyy HH:mm", { locale: th }),
        "แหล่งที่มา / แผนก": log.source_name || "ไม่ระบุ",
        "ประเภทขยะ": typesMap[log.waste_type]?.label || log.waste_type,
        "น้ำหนัก (กก.)": Number(log.weight),
        "หมายเหตุ": log.note || "-",
      }));

      const wsSource = XLSX.utils.json_to_sheet(sourceDataToExport);
      
      // จำกัดชื่อแท็บห้ามเกิน 31 ตัวอักษร (ตามกฎ Excel)
      const safeSheetName = sourceName.substring(0, 31);
      
      // เพิ่มชีทสถานที่นั้นๆ เข้าไปในเล่ม
      XLSX.utils.book_append_sheet(wb, wsSource, safeSheetName);
    });

    // 5. สั่งเขียนไฟล์และดาวน์โหลดออกมาเป็นไฟล์ Excel (.xlsx)
    const currentTabLabel = typesMap[activeTab]?.label || "รายงานขยะ";
    const fileName = `รายงาน_${currentTabLabel}_แยกสถานที่_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
    toast.success("ส่งออกข้อมูล Excel แยกแผ่นงานสถานที่เรียบร้อยแล้ว");
  };

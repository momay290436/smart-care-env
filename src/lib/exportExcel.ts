import * as XLSX from "xlsx";

export function exportToExcel(data: Record<string, any>[], filename: string, sheetName = "Sheet1") {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportMultiSheet(sheets: { name: string; data: Record<string, any>[] }[], filename: string) {
  const wb = XLSX.utils.book_new();
  sheets.forEach((s) => {
    if (s.data.length > 0) {
      const ws = XLSX.utils.json_to_sheet(s.data);
      XLSX.utils.book_append_sheet(wb, ws, s.name.substring(0, 31));
    }
  });
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export const DEFAULT_RATES: Record<string, number> = { 
  THB: 1, 
  USD: 0.028, 
  EUR: 0.025, 
  JPY: 4.2, 
  CNY: 0.2, 
  GBP: 0.022, 
  SGD: 0.038 
};

export const convertPrice = (
  amount: number, 
  fromCur: string, 
  toCur: string, 
  ratesObj: Record<string, number>
): number => {
  if (!ratesObj || !ratesObj[fromCur] || !ratesObj[toCur]) return amount;
  return amount * (ratesObj[toCur] / ratesObj[fromCur]);
};

export const formatCur = (amount: number, cur: string = 'THB'): string => {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: cur }).format(amount);
};

export const exportToCSV = (filename: string, rows: any[][]): void => {
  const processRow = (row: any[]): string => {
    let finalVal = '';
    for (let j = 0; j < row.length; j++) {
      let innerValue = row[j] === null || row[j] === undefined ? '' : row[j].toString();
      if (row[j] instanceof Date) {
        innerValue = row[j].toLocaleString();
      }
      let result = innerValue.replace(/"/g, '""');
      if (result.search(/("|,|\n)/g) >= 0) {
        result = '"' + result + '"';
      }
      if (j > 0) finalVal += ',';
      finalVal += result;
    }
    return finalVal + '\n';
  };

  let csvFile = '\uFEFF'; 
  for (let i = 0; i < rows.length; i++) {
    csvFile += processRow(rows[i]);
  }

  const blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

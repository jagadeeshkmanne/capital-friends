const activeOther = [
  { investmentName: 'EPF', investedAmount: 0, currentValue: 2800000 },
  { investmentName: 'Gratuity', investedAmount: 0, currentValue: 800000 },
  { investmentName: 'Miyapur Flat', investedAmount: 0, currentValue: 6000000 },
  { investmentName: 'Tellapur Flat', investedAmount: 13000000, currentValue: 16000000 },
  { investmentName: 'Ornament', investedAmount: 0, currentValue: 3500000 },
  { investmentName: 'Open Plot', investedAmount: 0, currentValue: 3000000 }
];

const otherInvested = activeOther.reduce((s, i) => s + (Number(i.investedAmount) > 1 ? Number(i.investedAmount) : Number(i.currentValue)), 0);
console.log("Calculated Invested (with > 1):", otherInvested);

const otherInvested2 = activeOther.reduce((s, i) => s + (Number(i.investedAmount) > 0 ? Number(i.investedAmount) : Number(i.currentValue)), 0);
console.log("Calculated Invested (with > 0):", otherInvested2);

const otherInvested3 = activeOther.reduce((s, i) => s + (Number(i.investedAmount) > 0 ? Number(i.investedAmount) : Number(i.currentValue || 0)), 0);
console.log("Calculated Invested (with || 0):", otherInvested3);

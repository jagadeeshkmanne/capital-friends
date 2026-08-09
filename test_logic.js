const investedAmount = "0";
const currentValue = 2800000;
const result = Number(investedAmount) > 0 ? Number(investedAmount) : Number(currentValue || 0);
console.log("String '0':", result);

const investedAmount2 = 0;
const result2 = Number(investedAmount2) > 0 ? Number(investedAmount2) : Number(currentValue || 0);
console.log("Number 0:", result2);

const investedAmount3 = "";
const result3 = Number(investedAmount3) > 0 ? Number(investedAmount3) : Number(currentValue || 0);
console.log("Empty string:", result3);

const investedAmount4 = null;
const result4 = Number(investedAmount4) > 0 ? Number(investedAmount4) : Number(currentValue || 0);
console.log("null:", result4);

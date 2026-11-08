const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const getMonthIndex = (monthName) => {
  return MONTHS.findIndex(
    (month) => month.toLowerCase() === String(monthName).toLowerCase()
  );
};

export const getDateRangeForMonth = (monthName, year) => {
  const monthIndex = getMonthIndex(monthName);
  const normalizedYear = parseInt(year, 10) || new Date().getFullYear();
  const startDate = new Date(normalizedYear, monthIndex, 1);
  const endDate = new Date(normalizedYear, monthIndex + 1, 0);

  return {
    startDate: `${normalizedYear}-${String(monthIndex + 1).padStart(2, '0')}-01`,
    endDate: `${normalizedYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`,
    monthIndex,
    monthLabel: MONTHS[monthIndex] || monthName,
    year: normalizedYear,
    daysInMonth: endDate.getDate(),
  };
};

export const getPreviousMonthRange = (monthName, year) => {
  const { monthIndex, year: normalizedYear } = getDateRangeForMonth(monthName, year);
  const previousMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1;
  const previousYear = monthIndex === 0 ? normalizedYear - 1 : normalizedYear;
  const startDate = `${previousYear}-${String(previousMonthIndex + 1).padStart(2, '0')}-01`;
  const endDate = `${previousYear}-${String(previousMonthIndex + 1).padStart(2, '0')}-${String(new Date(previousYear, previousMonthIndex + 1, 0).getDate()).padStart(2, '0')}`;

  return {
    startDate,
    endDate,
    monthLabel: MONTHS[previousMonthIndex],
    year: previousYear,
    monthIndex: previousMonthIndex,
  };
};

export const getMonthYearLabel = (monthName, year) => {
  const normalizedYear = parseInt(year, 10) || new Date().getFullYear();
  return `${monthName} ${normalizedYear}`;
};

export const formatCurrency = (value) => {
  const amount = Math.abs(parseFloat(value) || 0);
  return `₦${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatPercent = (value) => {
  const percent = Math.round(value * 10) / 10;
  return `${percent}%`;
};

export const getStatusColor = (status) => {
  const key = String(status || '').toLowerCase();
  switch (key) {
    case 'success':
    case 'successful':
    case 'completed':
      return '#2FB86D';
    case 'refunded':
    case 'reversed':
      return '#007BFF';
    case 'pending':
    case 'processing':
      return '#F0AD4E';
    case 'failed':
    case 'declined':
      return '#D9534F';
    default:
      return '#64748B';
  }
};

const normalizeKey = (value) => String(value || 'Unknown').trim() || 'Unknown';

const getDayName = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { weekday: 'long' });
};

const getWeekLabel = (dateString) => {
  const date = new Date(dateString);
  return `W${Math.min(4, Math.ceil(date.getDate() / 7))}`;
};

export const summarizeTransactions = (transactions, daysInMonth = 30) => {
  const result = {
    totalTransactions: 0,
    totalIn: 0,
    totalOut: 0,
    netFlow: 0,
    totalFlow: 0,
    averageTransaction: 0,
    largestTransaction: 0,
    smallestTransaction: 0,
    averageDailySpend: 0,
    savingsRate: 0,
    successRate: 0,
    refundRate: 0,
    mostActiveDay: 'N/A',
    mostActiveCategory: 'N/A',
    categoryBreakdown: [],
    statusBreakdown: [],
    topCategories: [],
    weeklyTrend: { labels: ['W1', 'W2', 'W3', 'W4'], income: [0, 0, 0, 0], expense: [0, 0, 0, 0] },
    earnings: 0,
    expenses: 0,
    successfulCredits: 0,
  };

  if (!Array.isArray(transactions) || transactions.length === 0) {
    return result;
  }

  const categoryMap = new Map();
  const statusMap = new Map();
  const dayMap = new Map();
  const weekTotals = [{ income: 0, expense: 0 }, { income: 0, expense: 0 }, { income: 0, expense: 0 }, { income: 0, expense: 0 }];

  let totalIn = 0;
  let totalOut = 0;
  let totalAmount = 0;
  let successCount = 0;
  let refundCount = 0;
  let failedCount = 0;
  let pendingCount = 0;
  let largest = 0;
  let smallest = Number.MAX_SAFE_INTEGER;

  transactions.forEach((item) => {
    const statusKey = normalizeKey(item.status).toLowerCase();
    const categoryKey = normalizeKey(item.category || item.transaction_type || item.service_name || 'Other');
    const direction = String(item.transaction_direction || '').toLowerCase();
    const amount = Math.abs(parseFloat(item.amount) || 0);
    const dateLabel = item.created_at || item.transaction_date || new Date().toISOString();

    if (!amount) return;

    totalAmount += amount;
    if (direction === 'credit') {
      totalIn += amount;
      successCount += ['success', 'successful', 'completed'].includes(statusKey) ? 1 : 0;
    } else {
      totalOut += amount;
    }

    if (['refunded', 'reversed'].includes(statusKey)) {
      refundCount += 1;
    }
    if (['failed', 'declined'].includes(statusKey)) {
      failedCount += 1;
    }
    if (['pending', 'processing'].includes(statusKey)) {
      pendingCount += 1;
    }

    if (amount > largest) {
      largest = amount;
    }
    if (amount < smallest) {
      smallest = amount;
    }

    const existingCategory = categoryMap.get(categoryKey) || { label: categoryKey, amount: 0, count: 0 };
    existingCategory.amount += amount;
    existingCategory.count += 1;
    categoryMap.set(categoryKey, existingCategory);

    const existingStatus = statusMap.get(statusKey) || { label: item.status || 'Unknown', amount: 0, count: 0, color: getStatusColor(statusKey) };
    existingStatus.amount += amount;
    existingStatus.count += 1;
    statusMap.set(statusKey, existingStatus);

    const dayName = getDayName(dateLabel);
    const dayEntry = dayMap.get(dayName) || 0;
    dayMap.set(dayName, dayEntry + amount);

    const weekIndex = Math.min(3, Math.max(0, Math.ceil(new Date(dateLabel).getDate() / 7) - 1));
    if (direction === 'credit') {
      weekTotals[weekIndex].income += amount;
    } else {
      weekTotals[weekIndex].expense += amount;
    }
  });

  const totalTransactions = transactions.length;
  const days = daysInMonth || 30;
  const totalFlow = totalIn + totalOut;
  const savingsRate = totalIn > 0 ? Math.max(0, ((totalIn - totalOut) / totalIn) * 100) : 0;
  const successRate = totalTransactions ? (successCount / totalTransactions) * 100 : 0;
  const refundRate = totalTransactions ? (refundCount / totalTransactions) * 100 : 0;
  const averageTransaction = totalTransactions ? totalAmount / totalTransactions : 0;
  const averageDailySpend = days ? totalOut / days : 0;

  const mostActiveDay = Array.from(dayMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
  const sortedCategory = Array.from(categoryMap.values()).sort((a, b) => b.amount - a.amount);
  const mostActiveCategory = sortedCategory[0]?.label || 'N/A';

  const categoryBreakdown = sortedCategory.map((entry, index, array) => ({
    ...entry,
    percentage: array.length ? Math.round((entry.amount / totalFlow) * 100) : 0,
    color: index === 0 ? '#2FB86D' : index === 1 ? '#0E3C2E' : index === 2 ? '#3B82F6' : index === 3 ? '#F59E0B' : '#A855F7',
  }));

  const statusBreakdown = Array.from(statusMap.values())
    .sort((a, b) => b.amount - a.amount)
    .map((entry) => ({
      ...entry,
      percentage: totalTransactions ? Math.round((entry.count / totalTransactions) * 100) : 0,
    }));

  const topCategories = categoryBreakdown.slice(0, 5).map((entry) => ({
    label: entry.label,
    amount: entry.amount,
    percentage: entry.percentage,
    color: entry.color,
  }));

  return {
    totalTransactions,
    totalIn,
    totalOut,
    netFlow: totalIn - totalOut,
    totalFlow,
    averageTransaction,
    largestTransaction: largest,
    smallestTransaction: smallest === Number.MAX_SAFE_INTEGER ? 0 : smallest,
    averageDailySpend,
    savingsRate,
    successRate,
    refundRate,
    mostActiveDay,
    mostActiveCategory,
    categoryBreakdown,
    statusBreakdown,
    topCategories,
    weeklyTrend: {
      labels: ['W1', 'W2', 'W3', 'W4'],
      income: weekTotals.map((item) => item.income),
      expense: weekTotals.map((item) => item.expense),
    },
    successfulCredits: successCount,
  };
};

export const compareMonthSummary = (current, previous) => {
  const diff = (currentValue = 0, previousValue = 0) => {
    if (!previousValue) return currentValue ? 100 : 0;
    return Math.round(((currentValue - previousValue) / previousValue) * 100);
  };

  return {
    flowChange: diff(current.totalFlow, previous.totalFlow),
    incomeChange: diff(current.totalIn, previous.totalIn),
    spendingChange: diff(current.totalOut, previous.totalOut),
    transactionChange: diff(current.totalTransactions, previous.totalTransactions),
    savingsChange: Math.round(current.savingsRate - previous.savingsRate),
    successRateChange: Math.round(current.successRate - previous.successRate),
  };
};

export const buildInsights = (current, previous) => {
  const insights = [];
  if (current.totalTransactions === 0) {
    insights.push('No transaction activity for the selected month yet.');
    return insights;
  }

  insights.push(`Your highest transaction category was ${current.mostActiveCategory}.`);
  insights.push(`${current.successfulCredits} successful credits were received.`);

  if (current.savingsRate >= 20) {
    insights.push('Your savings rate is strong this month. Keep the momentum going.');
  } else if (current.savingsRate > 5) {
    insights.push('You have a healthy savings rate, but there is room to optimize spending.');
  } else {
    insights.push('Your savings rate is low; consider trimming variable spending.');
  }

  const highestCategory = current.categoryBreakdown[0];
  if (highestCategory) {
    insights.push(`You spent ${highestCategory.percentage}% of your flow on ${highestCategory.label}.`);
  }

  if (previous.totalTransactions > 0) {
    if (current.incomeChange !== undefined && current.incomeChange !== null) {
      insights.push(`Income ${compareMonthSummary(current, previous).incomeChange >= 0 ? 'grew' : 'fell'} by ${Math.abs(compareMonthSummary(current, previous).incomeChange)}% from last month.`);
    }
    if (current.totalOut > previous.totalOut) {
      insights.push(`Spending rose by ${Math.abs(compareMonthSummary(current, previous).spendingChange)}% compared to the previous month.`);
    }
  }

  return insights.slice(0, 5);
};

export const getFinancialHealthScore = (summary) => {
  const savingsScore = Math.min(30, Math.max(0, summary.savingsRate * 1.25));
  const successScore = Math.min(30, Math.max(0, summary.successRate));
  const refundScore = Math.max(0, 15 - summary.refundRate * 2);
  const balanceScore = summary.netFlow >= 0 ? 15 : Math.max(0, 5 + (summary.netFlow / (Math.abs(summary.totalOut) + 1)) * 10);
  const score = Math.min(100, Math.round(40 + savingsScore * 0.6 + successScore * 0.25 + refundScore * 0.15 + balanceScore));

  const label = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Improvement needed';

  return { score, label };
};

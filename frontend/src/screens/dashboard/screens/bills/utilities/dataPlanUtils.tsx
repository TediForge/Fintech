const broadBandKeywords = ['broadband', 'boardband'];

const cleanValidityText = (rawValidity = '') => {
  if (rawValidity === null || rawValidity === undefined) return '';

  const validityText = String(rawValidity).replace(/\s+/g, ' ').trim();
  if (!validityText) return '';

  const splitValidity = validityText.split(/[+]/)[0].trim();
  const cleanedText = splitValidity
    .replace(/\bmins?\b/gi, '')
    .replace(/\btalktime\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleanedText.replace(/[()]/g, '').trim();
};

const normalizeValidityLabel = (rawValidity = '') => {
  const cleanedValidity = cleanValidityText(rawValidity);
  if (!cleanedValidity) return '';

  const lowerCaseValidity = cleanedValidity.toLowerCase();

  if (lowerCaseValidity.includes('one month') || lowerCaseValidity.includes('1 month')) {
    return '30 Days';
  }

  if (lowerCaseValidity.includes('month')) {
    return '30 Days';
  }

  return cleanedValidity;
};

const isBroadbandPlan = (plan = {}) => {
  const searchableText = [
    plan.plan_name,
    plan.plan_size,
    plan.validity,
    plan.duration_category,
    plan.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return broadBandKeywords.some((keyword) => searchableText.includes(keyword));
};

const normalizeSinglePlan = (plan = {}) => ({
  ...plan,
  plan_name: plan.plan_name || plan.name || '',
  plan_size: plan.plan_size || plan.plan_name || '',
  selling_price: plan.selling_price ?? plan.amount ?? 0,
  validity: normalizeValidityLabel(plan.validity),
  duration_category: plan.duration_category || '',
});

const normalizeFetchedDataPlans = (plans = []) => {
  return plans
    .filter((plan) => !isBroadbandPlan(plan))
    .map((plan) => normalizeSinglePlan(plan));
};

const normalizeGroupedDataPlans = (groupedData = {}) => {
  const normalizedGroups = {};

  Object.entries(groupedData).forEach(([networkKey, durationGroups]) => {
    normalizedGroups[networkKey] = {};

    Object.entries(durationGroups || {}).forEach(([durationKey, plans]) => {
      normalizedGroups[networkKey][durationKey] = (Array.isArray(plans) ? plans : [])
        .filter((plan) => !isBroadbandPlan(plan))
        .map((plan) => normalizeSinglePlan(plan));
    });
  });

  return normalizedGroups;
};

export {
  cleanValidityText,
  normalizeValidityLabel,
  isBroadbandPlan,
  normalizeSinglePlan,
  normalizeFetchedDataPlans,
  normalizeGroupedDataPlans,
};

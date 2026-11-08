type SettingAuthFeature = {
  authRequired?: boolean;
  authMethod?: string;
  confirmRequired?: boolean;
};

export function getSettingAuthPolicy(feature: SettingAuthFeature = {}) {
  const authMethod = feature.authMethod === 'facial' || feature.authMethod === 'face' ? 'facial' : 'pin';

  return {
    authRequired: Boolean(feature.authRequired),
    authMethod,
    confirmRequired: Boolean(feature.confirmRequired),
  };
}

export function shouldPromptForAuth(feature: SettingAuthFeature = {}) {
  return getSettingAuthPolicy(feature).authRequired;
}

export function shouldConfirmBeforeApply(feature: SettingAuthFeature = {}) {
  return getSettingAuthPolicy(feature).confirmRequired;
}


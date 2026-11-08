 const dicebearBaseUrl = 'https://api.dicebear.com/10.x';

const avatarStyles = [
  { id: 1, styleName: 'adventurer' },
  {
    id: 2,
    styleName: 'adventurer-neutral',
    backgroundColors: ['f2d3b1', 'ecad80', '9e5622', '763900'],
  },
  { id: 3, styleName: 'avataaars' },
  { id: 4, styleName: 'avataaars-neutral' },
  { id: 5, styleName: 'big-ears' },
  { id: 6, styleName: 'big-ears-neutral' },
  { id: 7, styleName: 'big-smile' },
  { id: 8, styleName: 'bottts' },
  { id: 9, styleName: 'bottts-neutral' },
  { id: 10, styleName: 'croodles' },
  { id: 11, styleName: 'croodles-neutral' },
  { id: 12, styleName: 'fun-emoji' },
  { id: 13, styleName: 'lorelei' },
  { id: 14, styleName: 'lorelei-neutral' },
  { id: 15, styleName: 'micah' },
  { id: 16, styleName: 'miniavs' },
  { id: 17, styleName: 'notionists' },
  { id: 18, styleName: 'notionists-neutral' },
  { id: 19, styleName: 'open-peeps' },
  { id: 20, styleName: 'personas' },
  { id: 21, styleName: 'pixel-art' },
  { id: 22, styleName: 'pixel-art-neutral' },
  {
    id: 23,
    styleName: 'toon-head',
    beardVariants: ['chin', 'chinMoustache', 'fullBeard', 'longBeard', 'moustacheTwirl'],
    clothesVariants: ['dress', 'openJacket', 'shirt', 'tShirt', 'turtleNeck'],
    clothesProbability: 100,
  },
];

const approvedStyles = [23];

const defaultBackgroundColor = 'E5E7EB';

export const buildAvatarUrl = ({ seed, style = 'avataaars', size = 128, backgroundColor = defaultBackgroundColor, beardVariant, clothesVariant, clothesProbability } = {}) => {
  const safeSeed = encodeURIComponent(seed || 'cardglade-user');
  const safeStyle = style || 'avataaars';
  const safeSize = Math.min(Math.max(Number(size) || 128, 1), 256);
  const safeBackgroundColor = backgroundColor || defaultBackgroundColor;
  const queryParams = [`seed=${safeSeed}`, `size=${safeSize}`, `backgroundColor=${safeBackgroundColor}`];

  if (beardVariant) {
    queryParams.push(`beardVariant=${encodeURIComponent(beardVariant)}`);
  }

  if (clothesVariant) {
    queryParams.push(`clothesVariant=${encodeURIComponent(clothesVariant)}`);
  }

  if (clothesProbability != null) {
    queryParams.push(`clothesProbability=${encodeURIComponent(clothesProbability)}`);
  }

  return `${dicebearBaseUrl}/${safeStyle}/png?${queryParams.join('&')}`;
};

export const loadAvatarOptions = ({ count = 12, seedPrefix = 'avatar' } = {}) => {
  return Array.from({ length: count }, (_, index) => {
    const seed = `${seedPrefix}-${index + 1}`;
    const approvedStyleId = approvedStyles[index % approvedStyles.length];
    const styleEntry = avatarStyles.find((item) => item.id === approvedStyleId);
    const styleName = styleEntry?.styleName || 'avataaars';
    const styleBackgroundColor = styleEntry?.backgroundColors?.join(',') || defaultBackgroundColor;
    const beardVariant = styleEntry?.id === 23 ? styleEntry.beardVariants?.[index % styleEntry.beardVariants.length] : undefined;
    const clothesVariant = styleEntry?.id === 23 ? styleEntry.clothesVariants?.[index % styleEntry.clothesVariants.length] : undefined;

    return {
      id: index + 1,
      title: `Avatar Character ${index + 1}`,
      subtitle: 'Tap to set as profile photo',
      url: buildAvatarUrl({ seed, style: styleName, size: 128, backgroundColor: styleBackgroundColor, beardVariant, clothesVariant, clothesProbability: styleEntry?.clothesProbability }),
    };
  });
};

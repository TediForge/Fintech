import React from 'react';
import OptionCard, { OptionCardSkeleton } from '@components/extra/OptionCard';

export const CountryOptionCardSkeleton = (props) => <OptionCardSkeleton {...props} />;

const CountryOptionCard = (props) => <OptionCard {...props} />;

export default CountryOptionCard;

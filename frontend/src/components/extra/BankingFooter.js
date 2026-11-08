import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { G, Text as SvgText, TSpan, Image as SvgImage } from 'react-native-svg';

import config from '@config/app';
import { brandConfig } from '@config/brand';
export default function BankingFooter() {
  return (
    <View style={styles.container}>
      {/* 
          Using viewBox="0 0 300 40" locks the internal coordinates. 
          This prevents "shaking" as every element is anchored to a fixed math point.
      */}
      <Svg height="40" width="300" viewBox="0 0 300 40">
        <G>
          {/* 
              Line 1: Icon and Brand Disclaimer 
              x="85" and y="15" are hard-coded anchors for pixel-perfect alignment.
          */}
          <SvgImage
            href={{ uri: 'https://cdn.cardglade.com/assets/4d71ee24729c67b5ef270512.png' }}
            x="80" 
            y="6.8"
            width="10"
            height="10"
            opacity={0.7} 
          />
          <SvgText
            x="92.3"
            y="15"
            fill="#8c8c8c"
            fontSize="9"
            fontFamily="Inter-Regular" // Using a specific font name prevents system font overrides
            letterSpacing={0.1}
          >
            <TSpan fontWeight="700" fill="#64748B">{brandConfig.brandName}</TSpan> is a non-bank fintech
          </SvgText>

          {/* 
              Line 2: Partner Disclosure 
              textAnchor="middle" at x="150" ensures perfect horizontal centering.
          */}
          <SvgText
            x="105"
            y="30"
            fill="#8c8c8c"
            fontSize="9"
            fontFamily="Inter-Regular"
            textAnchor="middle"
            letterSpacing={0.1}
          >
            Services are provided by<TSpan fontWeight="700" fill="#64748B">CBN-licensed partners</TSpan>
          </SvgText>
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    paddingVertical: 15, 
    paddingHorizontal: 20,
    alignItems: 'center', 
    justifyContent: 'center',
    width: '100%', 
  }
}); 
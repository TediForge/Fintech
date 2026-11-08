import React, { useState, useRef, useEffect } from "react";
import {
  View,
  ImageBackground,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

const { width } = Dimensions.get("window");

// Original image aspect ratio is 900:300 => 3:1
const IMAGE_WIDTH = 900;
const IMAGE_HEIGHT = 300;
const ASPECT_RATIO = IMAGE_HEIGHT / IMAGE_WIDTH;

const ITEM_WIDTH = width * 0.65; // scaled width
const ITEM_HEIGHT = ITEM_WIDTH * ASPECT_RATIO; // scale height proportionally
const SPACING = width * 0.05;

const SmallSizeImage = ({ isAuthResolved = true }) => {
  const navigation = useNavigation();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef(null);

  const slides = [
    {
      id: 1,
      image: "https://paysmart.com.ng/assets/SmallSlide/Slidenew9.png",
      page: "AirtimeScreen",
      actionType: "navigate",
    },
    {
      id: 2,
      image: "https://paysmart.com.ng/assets/SmallSlide/Slidenew16.png",
      page: "RefererScreen",
      actionType: "navigate",
    },
    {
      id: 3,
      image: "https://paysmart.com.ng/assets/SmallSlide/Slidenew15.png",
      page: "ElectricityScreen",
      actionType: "navigate",
    },
  ];

  const handlePress = (slide) => {
    if (slide.actionType === "navigate" && slide.page) {
      navigation.navigate(slide.page);
    }
  };

  // Auto-scroll every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const nextIndex = (activeIndex + 1) % slides.length;
      scrollRef.current?.scrollTo({
        x: nextIndex * (ITEM_WIDTH + SPACING),
        animated: true,
      });
      setActiveIndex(nextIndex);
    }, 10000);

    return () => clearInterval(interval);
  }, [activeIndex]);

  const handleScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / (ITEM_WIDTH + SPACING));
    setActiveIndex(newIndex);
  };

  if (!isAuthResolved) {
    return (
      <View style={styles.placeholderWrapper}>
        <View style={styles.placeholderImage} />
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_WIDTH + SPACING}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: SPACING }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;
          const isLast = index === slides.length - 1;

          return (
            <TouchableOpacity
              key={slide.id}
              activeOpacity={0.9}
              onPress={() => handlePress(slide)}
              style={[
                styles.imageContainer,
                {
                  marginRight: isLast ? 10 : SPACING,
                  transform: [{ scale: isActive ? 1.05 : 0.9 }],
                  opacity: isActive ? 1 : 0.8,
                },
              ]}
            >
              <ImageBackground
                source={{ uri: slide.image }} // ✅ Using original URL, no cache busting
                style={styles.imageBackground}
                imageStyle={{ borderRadius: 12 }}
                resizeMode="cover"
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  placeholderWrapper: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  placeholderImage: {
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    borderRadius: 12,
    backgroundColor: '#EDF4EF',
  },
  wrapper: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 3,
    marginVertical: 10,
  },
  imageContainer: {
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    marginVertical: 10,
  },
  imageBackground: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
});

export default SmallSizeImage;
import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@providers/ThemeProvider';

// Light-mode palette: a soft dark overlay that sits on top of light
// surfaces (white, #eff7f4, etc.) so the field reads as "lifted"
// without needing to match an exact background color.
const LIGHT_COLORS = {
  background: 'rgba(0, 0, 0, 0.04)',
  border: 'rgba(0, 0, 0, 0.1)',
  icon: 'rgba(0, 0, 0, 0.54)',
  text: 'rgba(0, 0, 0, 0.87)',
  placeholder: 'rgba(0, 0, 0, 0.54)',
};

// Dark-mode palette: the inverse — a soft light overlay that works on
// any dark surface (black, dark green, navy, etc.).
const DARK_COLORS = {
  background: 'rgba(255, 255, 255, 0.08)',
  border: 'rgba(255, 255, 255, 0.16)',
  icon: 'rgba(255, 255, 255, 0.6)',
  text: 'rgba(255, 255, 255, 0.87)',
  placeholder: 'rgba(255, 255, 255, 0.6)',
};

const SearchBar = ({ searchQuery, setSearchQuery, placeholder = "Search", containerStyle, inputContainerStyle }) => {
  const { isDark } = useTheme();
  const palette = isDark ? DARK_COLORS : LIGHT_COLORS;

  return (
    <View style={[styles.searchSection, containerStyle]}>
      <View style={[
        styles.searchContainer,
        inputContainerStyle,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
        }
      ]}>
        <Ionicons name="search" size={18} color={palette.icon} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: palette.text }]}
          placeholder={placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={palette.placeholder}
        />
        {searchQuery?.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={18} color={palette.icon} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  searchSection: {
    width: '100%',
  },
  searchContainer: {
    width: '100%',
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 45,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    height: "100%",
  },
});

export default SearchBar;

/* USAGE EXAMPLE:

  import SearchBar from '@components/common/SearchBar';

  <SearchBar 
    searchQuery={searchQuery} 
    setSearchQuery={setSearchQuery} 
    placeholder="Search for a brand" // Optional: defaults to "Search" if omitted
  />
*/
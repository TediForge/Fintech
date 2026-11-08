# Dashboard Tab Screens - Component Rules & Standards

## Overview

Tab screens in this dashboard must follow strict performance and UX standards to ensure smooth transitions, no layout shifts, and predictable behavior. All screens are rendered through the `TabNavigator` component which manages state centrally.

---

## Rules for Tab Components

### 1. **Component Structure**

Every tab screen component MUST follow this structure:

```javascript
import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';

export default function TabScreen({ renderTab }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialization on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch data here
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Content */}
    </ScrollView>
  );
}
```

### 2. **Props**

Each tab screen receives:

| Prop | Type | Description |
|------|------|-------------|
| `renderTab` | `function` | Callback to navigate to another tab: `renderTab('TabName')` |

**Example Usage:**
```javascript
<TouchableOpacity onPress={() => renderTab('Finance')}>
  <Text>Go to Finance Tab</Text>
</TouchableOpacity>
```

### 3. **Loading States - Use Skeleton Loaders**

**❌ WRONG - Full Screen Loader:**
```javascript
// DON'T USE THIS - causes blank screen flickering
import LoadingScreen from '@components/Loading/LoadingScreen';

return <LoadingScreen visible={loading} message="Please Wait" />;
```

**✅ CORRECT - Skeleton Loaders:**
```javascript
import { SkeletonSection } from '../../components/loaders/SkeletonScreen';

return (
  <ScrollView>
    {loading ? (
      <SkeletonSection type="list" itemCount={3} style={{ padding: 12 }} />
    ) : (
      <View>{/* Actual content */}</View>
    )}
  </ScrollView>
);
```

### 4. **Available Skeleton Components**

Located in: `dashboard/components/loaders/SkeletonScreen.js`

#### `<SkeletonCard>`
Perfect for content cards
```javascript
<SkeletonCard show={loading} style={{ margin: 12 }} />
```

#### `<SkeletonListItem>`
For list items with optional image
```javascript
<SkeletonListItem show={loading} showImage={true} />
```

#### `<SkeletonBanner>`
For banner/hero sections
```javascript
<SkeletonBanner show={loading} style={{ height: 200 }} />
```

#### `<SkeletonGrid>`
For grid layouts
```javascript
<SkeletonGrid show={loading} columns={2} itemCount={6} />
```

#### `<SkeletonText>`
For text/paragraph placeholders
```javascript
<SkeletonText show={loading} lines={3} />
```

#### `<SkeletonButton>`
For button placeholders
```javascript
<SkeletonButton show={loading} style={{ marginVertical: 12 }} />
```

#### `<SkeletonSection>`
Complete section with multiple items
```javascript
<SkeletonSection show={loading} type="list" itemCount={4} style={{ padding: 12 }} />
```

### 5. **Styling Rules**

**Container:**
```javascript
container: {
  flex: 1,
  backgroundColor: '#ffffff',
}
```

**DO:**
- Use consistent spacing (8px, 12px, 16px grid)
- Use flex layouts for responsive design
- Set fixed heights for images/content to prevent layout shifts
- Use `showsVerticalScrollIndicator={false}` on ScrollView for cleaner UI

**DON'T:**
- Don't use absolute positioning for main content
- Don't mix margin and padding without clear intent
- Don't use dynamic heights that change based on content

### 6. **Data Fetching Pattern**

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

const fetchData = useCallback(async () => {
  try {
    setLoading(true);
    setError(null);

    // Get user token
    const token = await AsyncStorage.getItem('sessionToken');
    if (!token) {
      setError('User not authenticated');
      return;
    }

    // Fetch data
    const response = await fetch(`${api}/v1/...`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) throw new Error(response.statusText);

    const data = await response.json();
    setData(data);
  } catch (err) {
    setError(err.message);
    console.error('Fetch error:', err);
  } finally {
    setLoading(false);
  }
}, []);
```

### 7. **Error Handling**

Always display errors gracefully:

```javascript
import { Alert } from 'react-native';

// Show error toast/alert
if (error) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>⚠️ {error}</Text>
      <TouchableOpacity 
        style={styles.retryButton}
        onPress={fetchData}
      >
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### 8. **Performance Optimization**

**Use `useCallback` for callbacks:**
```javascript
const handlePress = useCallback((id) => {
  navigation.navigate('Details', { id });
}, [navigation]);
```

**Memoize lists:**
```javascript
import { useMemo } from 'react';

const displayItems = useMemo(() => {
  return items.filter(item => item.active);
}, [items]);
```

**Use `React.memo` for sub-components:**
```javascript
const ListItem = React.memo(({ item, onPress }) => {
  return (
    <TouchableOpacity onPress={() => onPress(item.id)}>
      <Text>{item.name}</Text>
    </TouchableOpacity>
  );
});
```

### 9. **No Layout Shifts**

**Problem Scenario:**
```javascript
// ❌ BAD - causes shifting
{loading ? <Skeleton /> : <View>{content}</View>}
```

**Solution:**
```javascript
// ✅ GOOD - maintains layout
return (
  <View style={{ flex: 1 }}>
    {loading ? (
      <SkeletonSection type="list" itemCount={3} />
    ) : (
      <FlatList data={items} renderItem={renderItem} />
    )}
  </View>
);
```

---

## Example: Complete Tab Screen

```javascript
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SkeletonSection } from '../../components/loaders/SkeletonScreen';

const BRAND_COLOR = '#0E3C2E';

export default function FinanceScreen({ renderTab }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await AsyncStorage.getItem('sessionToken');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${api}/v1/finance/summary`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error('Failed to fetch');

      const json = await response.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const displayItems = useMemo(() => {
    return data?.transactions || [];
  }, [data]);

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>⚠️ {error}</Text>
        <TouchableOpacity style={styles.button} onPress={fetchData}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {loading ? (
        <SkeletonSection type="list" itemCount={4} style={{ padding: 12 }} />
      ) : (
        <View style={{ padding: 12 }}>
          {displayItems.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardAmount}>{item.amount}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, color: '#d32f2f', marginBottom: 12, textAlign: 'center' },
  button: { backgroundColor: BRAND_COLOR, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: '#f7f9f8', padding: 12, borderRadius: 12, marginBottom: 10 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  cardAmount: { fontSize: 18, fontWeight: '700', color: BRAND_COLOR, marginTop: 4 },
});
```

---

## Checklist for New Tab Screens

- [ ] Receives `renderTab` prop
- [ ] Uses `useCallback` for event handlers
- [ ] Uses skeleton loaders instead of full-screen loading
- [ ] Sets fixed heights for non-text content
- [ ] No conditional rendering that causes layout shifts
- [ ] Proper error handling with retry option
- [ ] Token/authentication checks
- [ ] `ScrollView` with `showsVerticalScrollIndicator={false}`
- [ ] Consistent spacing (8/12/16px grid)
- [ ] No absolute positioning for main content
- [ ] Memoized callbacks and data

---

## Navigation Between Tabs

From any tab screen, navigate to another tab using the `renderTab` prop:

```javascript
// From any tab component
<TouchableOpacity onPress={() => renderTab('Finance')}>
  <Text>Go to Finance</Text>
</TouchableOpacity>

// Valid tab keys:
// 'Home', 'Finance', 'Reward', 'Cards', 'More'
```

---

## Performance Tips

1. **Always lazy-load data** - Don't fetch unless needed
2. **Use `useMemo` for derived data** - Prevent unnecessary computations
3. **Memoize components** - Use `React.memo` for list items
4. **Cache API responses** - Store in AsyncStorage when appropriate
5. **Debounce searches** - Use debouncing for search inputs
6. **Use `FlatList` for large lists** - Better than ScrollView for performance

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Blank screen on tab change | Check skeleton loaders are shown during loading |
| Layout shifts | Use fixed heights, don't conditionally render containers |
| Slow transitions | Memoize data, use React.memo for list items |
| Loading never completes | Check API endpoint, token validity |
| Tab doesn't change | Ensure tab key is in `IMPLEMENTED_SCREENS` in `dashboard/index.tsx` |

---

**Last Updated:** May 31, 2026  
**Maintained by:** Development Team  
**Version:** 1.0.0

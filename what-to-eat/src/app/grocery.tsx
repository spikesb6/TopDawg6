import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { BouncyPressable } from '@/components/bouncy-pressable';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icons';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { useTheme } from '@/hooks/use-theme';
import { track } from '@/lib/analytics';
import { groupByRecipe, listToText } from '@/lib/grocery';
import { useGrocery } from '@/store/grocery-store';
import { borderWidth, fonts, linkHitSlop, palette, radius } from '@/theme/theme';

export default function GroceryScreen() {
  const theme = useTheme();
  const grocery = useGrocery();
  const left = grocery.items.filter((i) => !i.checked).length;
  const anyChecked = grocery.items.some((i) => i.checked);

  return (
    <Screen>
      <ScreenHeader />
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
        Grocery list
      </Text>

      {grocery.items.length === 0 ? (
        <EmptyState
          icon="list"
          title="Your list is empty"
          body="Open a Cook it recipe and tap Add to grocery list."
        />
      ) : (
        <>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            {left === 0 ? 'All done. Happy cooking!' : `${left} left to buy`}
          </Text>

          {groupByRecipe(grocery.items).map((group) => (
            <View key={group.recipeId} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text style={[styles.groupTitle, { color: theme.text }]}>{group.recipeName}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${group.recipeName} from the list`}
                  hitSlop={linkHitSlop}
                  onPress={() => grocery.removeRecipe(group.recipeId)}>
                  <Text style={[styles.link, { color: theme.muted }]}>Remove</Text>
                </Pressable>
              </View>
              {group.items.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={[item.qty, item.name].filter(Boolean).join(' ')}
                  accessibilityState={{ checked: item.checked }}
                  onPress={() => grocery.toggle(item.id)}
                  style={({ pressed }) => [styles.item, pressed && { opacity: 0.6 }]}>
                  <View
                    style={[
                      styles.box,
                      { borderColor: theme.text },
                      item.checked && { backgroundColor: palette.mint, borderColor: palette.mint },
                    ]}>
                    {item.checked ? (
                      <Icon name="check" color={palette.ink} size={16} strokeWidth={3} />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.itemText,
                      { color: item.checked ? theme.muted : theme.text },
                      item.checked && styles.done,
                    ]}>
                    {item.qty ? <Text style={styles.qty}>{item.qty} </Text> : null}
                    {item.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))}

          <BouncyPressable
            accessibilityRole="button"
            accessibilityLabel="Share list"
            tilt={-1}
            onPress={() => {
              track({ name: 'grocery_shared' });
              Share.share({ message: listToText(grocery.items) }).catch(() => {});
            }}
            style={[styles.button, { borderColor: theme.border }]}>
            <Text style={styles.buttonLabel}>Share list</Text>
          </BouncyPressable>

          {anyChecked ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear checked items"
              onPress={grocery.clearChecked}
              style={styles.clear}>
              <Text style={[styles.link, { color: theme.text }]}>Clear checked items</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.heading,
    fontSize: 30,
    marginTop: 18,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    marginTop: 2,
  },
  group: {
    marginTop: 22,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  groupTitle: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 18,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    paddingVertical: 8,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  qty: {
    fontFamily: fonts.headingSemi,
  },
  done: {
    textDecorationLine: 'line-through',
  },
  button: {
    marginTop: 28,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 58,
    borderWidth,
    borderRadius: radius.button,
    backgroundColor: palette.sunny,
  },
  buttonLabel: {
    fontFamily: fonts.heading,
    fontSize: 19,
    color: palette.ink,
  },
  clear: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  link: {
    fontFamily: fonts.headingSemi,
    fontSize: 15,
    textDecorationLine: 'underline',
  },
});

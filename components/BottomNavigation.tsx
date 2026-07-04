import React from "react";
import { View, StyleSheet } from "react-native";
import { NavItem } from "./NavItem";
import { RecordQuestTheme } from "../constants/theme";

interface BottomNavigationProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

export function BottomNavigation({ activeScreen, onNavigate }: BottomNavigationProps) {
  return (
    <View style={styles.nav}>
      <NavItem label="Home" active={activeScreen === "Home"} onPress={() => onNavigate("Home")} />
      <NavItem
        label="Library"
        active={activeScreen === "Collection"}
        onPress={() => onNavigate("Collection")}
      />
      <NavItem
        label="Stores"
        active={activeScreen === "Stores" || activeScreen === "StoreDetail"}
        onPress={() => {
          onNavigate("Stores");
        }}
      />
      <NavItem label="Wishlist" active={activeScreen === "Wishlist"} onPress={() => onNavigate("Wishlist")} />
      <NavItem label="Profile" active={activeScreen === "Profile"} onPress={() => onNavigate("Profile")} />
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: RecordQuestTheme.colors.border,
    backgroundColor: "rgba(9, 10, 15, 0.98)",
    gap: 8,
  },
});

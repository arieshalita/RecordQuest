import React from "react";
import { View, StyleSheet } from "react-native";
import { NavItem } from "./NavItem";

interface BottomNavigationProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

export function BottomNavigation({ activeScreen, onNavigate }: BottomNavigationProps) {
  return (
    <View style={styles.nav}>
      <NavItem label="Home" active={activeScreen === "Home"} onPress={() => onNavigate("Home")} />
      <NavItem
        label="Collection"
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
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(124, 58, 237, 0.10)",
    backgroundColor: "#0a0a0f",
  },
});

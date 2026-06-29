import React from "react";
import { View, Text, Pressable, TextInput, StyleSheet } from "react-native";
import type { RecordItem } from "../hooks/types";

type ConfirmPurchaseDetailsModalProps = {
  visible: boolean;
  record: RecordItem | null;
  purchasedAtDetail: string;
  setPurchasedAtDetail: (value: string) => void;
  purchasePrice: string;
  setPurchasePrice: (value: string) => void;
  purchaseDate: string;
  setPurchaseDate: (value: string) => void;
  purchaseCondition: string;
  setPurchaseCondition: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmPurchaseDetailsModal({
  visible,
  record,
  purchasedAtDetail,
  setPurchasedAtDetail,
  purchasePrice,
  setPurchasePrice,
  purchaseDate,
  setPurchaseDate,
  purchaseCondition,
  setPurchaseCondition,
  onConfirm,
  onCancel,
}: ConfirmPurchaseDetailsModalProps) {
  if (!visible || !record) return null;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Purchase Details for "{record.album}"</Text>
        <Text style={styles.modalSubtitle}>Complete the details or skip to add with defaults.</Text>

        <View style={styles.formSection}>
          <Text style={styles.fieldLabel}>Store / Location (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Where did you find it?"
            placeholderTextColor="#8B8B96"
            value={purchasedAtDetail}
            onChangeText={setPurchasedAtDetail}
          />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.fieldLabel}>Price (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="$ Price paid"
            placeholderTextColor="#8B8B96"
            value={purchasePrice}
            onChangeText={setPurchasePrice}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.fieldLabel}>Purchase Date (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD or any format"
            placeholderTextColor="#8B8B96"
            value={purchaseDate}
            onChangeText={setPurchaseDate}
          />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.fieldLabel}>Condition</Text>
          <View style={styles.conditionPicker}>
            {["Mint", "Near Mint", "Very Good", "Good", "Fair", "Poor"].map((condition) => (
              <Pressable
                key={condition}
                style={[
                  styles.conditionButton,
                  purchaseCondition === condition && styles.conditionButtonActive,
                ]}
                onPress={() => setPurchaseCondition(condition)}
              >
                <Text
                  style={[
                    styles.conditionButtonText,
                    purchaseCondition === condition && styles.conditionButtonTextActive,
                  ]}
                >
                  {condition}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.modalButtons}>
          <Pressable style={[styles.modalButton, styles.modalButtonSecondary]} onPress={onCancel}>
            <Text style={styles.modalButtonTextSecondary}>Skip</Text>
          </Pressable>
          <Pressable style={[styles.modalButton, styles.modalButtonPrimary]} onPress={onConfirm}>
            <Text style={styles.modalButtonTextPrimary}>Add to Collection</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
    zIndex: 100,
  },
  modalContent: {
    backgroundColor: "#12102",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
  },
  modalTitle: {
    color: "#FFF4D6",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  modalSubtitle: {
    color: "#A7A1BD",
    fontSize: 13,
    marginBottom: 20,
  },
  formSection: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: "#D4AF37",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#1A1830",
    borderWidth: 1,
    borderColor: "#3E3B5C",
    borderRadius: 8,
    padding: 12,
    color: "#FFF4D6",
    fontSize: 14,
  },
  conditionPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  conditionButton: {
    backgroundColor: "#1A1830",
    borderWidth: 1,
    borderColor: "#3E3B5C",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  conditionButtonActive: {
    backgroundColor: "#7C3AED",
    borderColor: "#7C3AED",
  },
  conditionButtonText: {
    color: "#A7A1BD",
    fontSize: 12,
    fontWeight: "500",
  },
  conditionButtonTextActive: {
    color: "#FFF4D6",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalButtonPrimary: {
    backgroundColor: "#7C3AED",
  },
  modalButtonTextPrimary: {
    color: "#FFF4D6",
    fontWeight: "700",
    fontSize: 14,
  },
  modalButtonSecondary: {
    backgroundColor: "#3E3B5C",
  },
  modalButtonTextSecondary: {
    color: "#A7A1BD",
    fontWeight: "600",
    fontSize: 14,
  },
});

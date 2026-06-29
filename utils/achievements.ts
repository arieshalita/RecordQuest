import { RecordItem, AchievementBadge, AchievementCategory } from "../hooks/types";

export function calculateAchievementCategories(
  records: RecordItem[],
  wishlist: RecordItem[],
  storeCheckIns: Record<string, number>,
  activity: string[]
): AchievementCategory[] {
  const totalRecords = records.length;
  const totalWishlist = wishlist.length;
  const totalCheckIns = Object.values(storeCheckIns).reduce((sum, count) => sum + count, 0);
  const wishlistFoundCount = activity.filter((entry) => entry.startsWith("Found ")).length;
  const storyCount = records.filter((record) => !!record.notes?.trim()).length;
  const ratingCount = records.filter((record) => typeof record.rating === "number" && record.rating > 0).length;
  const priceCount = records.filter((record) => !!record.price?.trim()).length;
  const purchasedAtCount = records.filter((record) => !!record.purchasedAt?.trim()).length;

  const buildBadge = (
    id: string,
    emoji: string,
    label: string,
    requirement: string,
    current: number,
    target: number
  ): AchievementBadge => ({
    id,
    emoji,
    label,
    requirement,
    current,
    target,
    unlocked: current >= target,
  });

  return [
    {
      title: "Collection",
      badges: [
        buildBadge("first-record", "💿", "First Record", "Own at least 1 record", totalRecords, 1),
        buildBadge("collector", "🎯", "Collector", "Own at least 10 records", totalRecords, 10),
        buildBadge("archivist", "🗄️", "Archivist", "Own at least 50 records", totalRecords, 50),
        buildBadge("vinyl-vault", "🕳️", "Vinyl Vault", "Own at least 100 records", totalRecords, 100),
      ],
    },
    {
      title: "Wishlist",
      badges: [
        buildBadge("wishful-thinking", "✨", "Wishful Thinking", "Have at least 1 wishlist item", totalWishlist, 1),
        buildBadge(
          "dream-found",
          "🏆",
          "Dream Found",
          "Move at least 1 wishlist item into your collection",
          wishlistFoundCount,
          1
        ),
      ],
    },
    {
      title: "Store Explorer",
      badges: [
        buildBadge("first-check-in", "📍", "First Check In", "Check in at least once", totalCheckIns, 1),
        buildBadge("crate-digger", "🧺", "Crate Digger", "Complete at least 5 store check-ins", totalCheckIns, 5),
        buildBadge("road-trip", "🛣️", "Road Trip", "Complete at least 10 store check-ins", totalCheckIns, 10),
        buildBadge("local-legend", "🌟", "Local Legend", "Complete at least 25 store check-ins", totalCheckIns, 25),
      ],
    },
    {
      title: "Collector Journal",
      badges: [
        buildBadge("storyteller", "📖", "Storyteller", "Add notes to at least 5 records", storyCount, 5),
        buildBadge("critic", "📝", "Critic", "Rate at least 5 records", ratingCount, 5),
        buildBadge("receipt-keeper", "💳", "Receipt Keeper", "Add price info to at least 5 records", priceCount, 5),
        buildBadge("memory-lane", "🗺️", "Memory Lane", "Add purchased-at info to at least 5 records", purchasedAtCount, 5),
      ],
    },
  ];
}

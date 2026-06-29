# RecordQuest Refactoring - Manual Testing Checklist

## Pre-Integration Testing (Current State)

### TypeScript Validation
- [x] New component files compile without errors
- [x] Utility files compile without errors  
- [x] Type definitions compile without errors
- [ ] Full project compiles (Phase 2 after integration)

### Component-Level Testing

#### StatCard Component
- [ ] Displays correct value and label
- [ ] Uses premium dark theme colors
- [ ] Properly sized on home screen
- [ ] No text wrapping or truncation

#### AnalyticsCard Component
- [ ] Displays value, label, and icon
- [ ] Font scales correctly for long values (10-16px)
- [ ] Text doesn't wrap (ellipsizeMode works)
- [ ] No cramping or layout issues
- [ ] Proper card styling and spacing

#### AchievementBadgeCard Component
- [ ] Shows locked badge with muted colors
- [ ] Shows unlocked badge with gold highlight
- [ ] Displays emoji, label, requirement, progress, and status
- [ ] Locked badges show different styling
- [ ] Progress shows "X / Y" format correctly
- [ ] Status shows "Locked" or "Unlocked"

#### TopBar Component
- [ ] Back button shows and is clickable
- [ ] Title displays centered
- [ ] Music note icon shows on right
- [ ] Border styling correct
- [ ] Back button triggers callback

#### NavItem Component
- [ ] Shows label and dot indicator
- [ ] Active state highlighted in gold
- [ ] Inactive state in muted color
- [ ] Pressable and triggers callback
- [ ] Proper spacing in navigation

#### BottomNavigation Component
- [ ] All 5 nav items visible (Home, Collection, Stores, Wishlist, Profile)
- [ ] Active screen highlighted
- [ ] All onPress callbacks work
- [ ] Proper layout and spacing
- [ ] Background and border styling correct

#### EmptyState Component
- [ ] Displays title and subtitle
- [ ] Uses dashed border style
- [ ] Proper padding and centering
- [ ] Color scheme correct

#### Toast Component
- [ ] Appears at top of screen
- [ ] Purple background with gold text
- [ ] Proper shadow and elevation
- [ ] z-index allows visibility over content
- [ ] Text is readable

#### HomeCard Component
- [ ] Shows title and subtitle
- [ ] Right arrow indicator visible
- [ ] Pressable and triggers onPress
- [ ] Proper spacing and styling
- [ ] Color scheme matches theme

### Utility Testing

#### achievements.ts
- [ ] calculateAchievementCategories runs without errors
- [ ] Returns correct badge counts
- [ ] Unlocked badges calculated correctly
- [ ] Progress values accurate
- [ ] All 4 categories returned

#### analytics.ts
- [ ] calculateCollectionAnalytics runs without errors
- [ ] Artist count calculation correct
- [ ] Genre count calculation correct
- [ ] Average year calculated (ignoring "Unknown")
- [ ] Oldest/newest albums identified
- [ ] Most collected artist determined
- [ ] Favorite genre determined
- [ ] Store visit counts accurate
- [ ] Check-in totals correct
- [ ] Wishlist completion % correct

### Type Definitions Testing

- [ ] All types export correctly from hooks/types.ts
- [ ] RecordItem type has all fields
- [ ] StoreItem type has all fields
- [ ] AchievementBadge type has all fields
- [ ] No circular dependencies

## Post-Integration Testing (Phase 2)

### Full App Compilation
- [ ] `npx tsc --noEmit --skipLibCheck` passes with 0 errors
- [ ] All components import correctly
- [ ] All utilities import correctly
- [ ] All types import correctly

### Screen Testing

#### HomeScreen
- [ ] Logo and tagline visible
- [ ] Hero section displays with proper styling
- [ ] Stats cards show correct counts
- [ ] All navigation cards clickable
- [ ] Navigation cards trigger proper screen changes

#### CollectionScreen (Once Extracted)
- [ ] Album/Artist input fields work
- [ ] "Purchased at" field present (not on Wishlist)
- [ ] Search button works
- [ ] Search results display correctly
- [ ] Can select result from dropdown
- [ ] Add button works
- [ ] Records list shows with proper styling
- [ ] Remove button works
- [ ] Empty state shows when no records
- [ ] Success toast on add

#### WishlistScreen (Once Extracted)
- [ ] Album/Artist input fields work
- [ ] NO "Purchased at" field
- [ ] Search functionality works
- [ ] Can add to wishlist
- [ ] "Found" button shows on wishlist items
- [ ] Mark found opens purchase modal
- [ ] Empty state shows when empty
- [ ] Success toast on add

#### AlbumDetailScreen (Once Extracted)
- [ ] Opens from record click
- [ ] Displays all album information
- [ ] Edit mode can be toggled
- [ ] All fields editable in edit mode
- [ ] Rating stars interactive
- [ ] Save button works with success toast
- [ ] Delete button works with success toast
- [ ] Back button closes screen correctly

#### ProfileScreen (Once Extracted)
- [ ] User profile card displays
- [ ] Stats show correct counts
- [ ] Analytics dashboard displays
- [ ] All analytics cards formatted correctly (no text wrapping)
- [ ] Achievements show locked/unlocked correctly
- [ ] Recent activity shows (or empty state)
- [ ] Empty activity state shows when no activity

#### StoreFinderScreen (Once Extracted)
- [ ] All stores display with information
- [ ] Check-in button works and increments count
- [ ] Check-in success toast shows
- [ ] Directions button opens maps
- [ ] View store button opens detail screen
- [ ] Empty state shows when no stores
- [ ] Visit counts persist

#### StoreDetailScreen (Once Extracted)
- [ ] Store information displays
- [ ] Visit count shows
- [ ] Check-in button works
- [ ] Directions button works
- [ ] Back button returns to store list

### Feature Integration Testing

#### Collection Management
- [ ] Add record to collection works
- [ ] Remove from collection works
- [ ] Success toasts display
- [ ] Records persist to storage
- [ ] Search integration works
- [ ] Metadata from search applied

#### Wishlist Workflow
- [ ] Add to wishlist works
- [ ] Mark found opens modal
- [ ] Purchase details modal works
- [ ] Moving to collection works
- [ ] Wishlist item removed on move
- [ ] Added to collection
- [ ] Success toast shows "Found [Album]"

#### Album Details
- [ ] Edit fields work
- [ ] Save updates record
- [ ] Delete removes record
- [ ] Rating system works
- [ ] Notes save correctly
- [ ] Purchase info saved
- [ ] Back navigation works

#### Store Check-ins
- [ ] Check-in increments counter
- [ ] Count persists
- [ ] Success toast shows store name
- [ ] Achievements track check-ins
- [ ] Directions integration works

#### Persistence
- [ ] Close app and reopen
- [ ] All records still present
- [ ] All wishlist items still present
- [ ] All activity log preserved
- [ ] Store visit counts preserved
- [ ] All edits preserved

### UI/UX Testing

#### Visual Consistency
- [ ] Premium dark theme throughout
- [ ] Purple accents consistent
- [ ] Gold highlights used correctly
- [ ] Typography hierarchy clear
- [ ] Spacing and padding consistent
- [ ] Colors not changed from original

#### Usability
- [ ] All buttons properly sized and tappable
- [ ] Text legible (no truncation issues)
- [ ] Forms intuitive
- [ ] Navigation clear
- [ ] No layout issues on different screen sizes
- [ ] Scrolling works smoothly

#### Feedback
- [ ] Success toasts appear for all actions
- [ ] Empty states show with proper messaging
- [ ] Error messages clear (if any)
- [ ] Loading indicators work
- [ ] No orphaned UI elements

### Performance
- [ ] App loads quickly
- [ ] No lag when adding records
- [ ] Search completes in reasonable time
- [ ] Scrolling smooth
- [ ] No memory leaks

### Browser/Device Compatibility
- [ ] Works on iOS simulator/device
- [ ] Works on Android emulator/device
- [ ] Responsive to different screen sizes
- [ ] Portrait and landscape modes

---

## Acceptance Criteria

✅ **All functionality preserved**
- No feature removed
- No behavior changed
- All workflows working

✅ **Code quality improved**
- Better organization
- Reusable components
- Centralized utilities
- No duplication

✅ **No UI changes**
- Same colors
- Same layout
- Same typography
- Same design

✅ **TypeScript validates**
- Zero compilation errors
- Proper type checking
- All imports resolve

✅ **Tests pass**
- All manual tests pass
- App compiles and runs
- All features functional

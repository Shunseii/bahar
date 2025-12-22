# Mobile App Implementation Plan

## Goal
Bring mobile app to feature parity with web app (except import/export), using:
- Tailwind v4 with Uniwind
- Turso per-user databases (op-sqlite with libsql sync)
- Orama search (remove Meilisearch)
- End-to-end working app, no placeholders

---

## Current State (as of investigation)

### What's Working
- [x] Uniwind v1.0.4 installed and configured
- [x] Expo SDK 54 with React Native 0.81.5
- [x] Op-SQLite with Turso sync configured
- [x] Orama installed (but not hydrated on startup)
- [x] Authentication (Email OTP) working
- [x] Flashcard review with FSRS algorithm
- [x] Drawer navigation structure
- [x] i18n with Lingui (Arabic/English)
- [x] React Query, Jotai, React Hook Form setup

### What's Missing/Broken
- [ ] Safe areas being overlapped by status bar/bottom buttons
- [ ] Home screen is placeholder (no dictionary list)
- [ ] Search bar not connected to Orama
- [ ] No dictionary entry detail view
- [ ] No edit word functionality
- [ ] Decks screen is placeholder
- [ ] Settings screen incomplete
- [ ] No animations/transitions
- [ ] Orama not hydrated on app startup

---

## Implementation Tasks

### Phase 1: Core Infrastructure Fixes

#### 1.1 Fix Safe Areas
- [ ] Update `(search)/_layout.tsx` - header needs proper safe area
- [ ] Update drawer content safe area handling
- [ ] Ensure all screens respect safe areas
- [ ] Test on devices with notches/dynamic islands

**Files to modify:**
- `src/app/(search)/_layout.tsx`
- `src/components/Page.tsx`

#### 1.2 Initialize Orama on App Startup
- [ ] Create app initialization hook that runs on auth
- [ ] Call `hydrateOramaDb()` after database connection
- [ ] Show loading state during hydration
- [ ] Handle hydration errors gracefully

**Files to modify:**
- `src/app/(search)/_layout.tsx` or create `src/hooks/useAppInitialization.ts`
- `src/lib/search/index.ts`

---

### Phase 2: Dictionary Feature

#### 2.1 Dictionary List with Search
- [ ] Create `DictionaryList` component with FlatList
- [ ] Implement infinite scroll with Orama pagination
- [ ] Create `DictionaryEntryCard` component for list items
- [ ] Show word, translation, type, tags
- [ ] Empty state when no entries
- [ ] Loading skeleton during search

**Files to create:**
- `src/components/dictionary/DictionaryList.tsx`
- `src/components/dictionary/DictionaryEntryCard.tsx`
- `src/components/dictionary/DictionaryEmptyState.tsx`

**Files to modify:**
- `src/app/(search)/(home)/index.tsx`

#### 2.2 Connect Search Bar
- [ ] Pass search query from layout to home screen (context or params)
- [ ] Debounce search input (300ms)
- [ ] Detect language (Arabic vs English) for search
- [ ] Update results in real-time

**Files to modify:**
- `src/app/(search)/_layout.tsx`
- `src/app/(search)/(home)/index.tsx`

#### 2.3 Dictionary Entry Detail View
- [ ] Create bottom sheet or modal for entry details
- [ ] Show all fields: word, translation, definition, type, root, tags
- [ ] Show morphology details (noun/verb specific)
- [ ] Show examples with translations
- [ ] Show antonyms
- [ ] Edit button to navigate to edit screen
- [ ] Delete button with confirmation

**Files to create:**
- `src/components/dictionary/DictionaryEntrySheet.tsx`
- `src/components/dictionary/MorphologyDetails.tsx`

#### 2.4 Edit Word Screen
- [ ] Create edit word route `(home)/edit-word/[id].tsx`
- [ ] Reuse add word form components
- [ ] Pre-populate form with existing data
- [ ] Update local DB and Orama index on save
- [ ] Navigate back on success

**Files to create:**
- `src/app/(search)/(home)/edit-word/[id].tsx`

**Files to modify:**
- `src/app/(search)/(home)/add-word.tsx` - extract reusable form

#### 2.5 Delete Word
- [ ] Add delete mutation
- [ ] Confirmation dialog
- [ ] Remove from local DB and Orama index
- [ ] Update UI (remove from list)

---

### Phase 3: Deck Management

#### 3.1 Deck List Screen
- [ ] Replace placeholder with actual deck list
- [ ] Show deck name and card count
- [ ] "Study" button to start flashcard review with deck filter
- [ ] "Create deck" button

**Files to modify:**
- `src/app/(search)/decks.tsx`

**Files to create:**
- `src/components/decks/DeckList.tsx`
- `src/components/decks/DeckCard.tsx`

#### 3.2 Create Deck
- [ ] Modal or new screen for deck creation
- [ ] Name input
- [ ] Filter options:
  - Word types (Ism, Fi'l, Harf, Expression)
  - Tags (multi-select)
  - Flashcard states (New, Learning, Review, Re-learning)
- [ ] Save to database

**Files to create:**
- `src/components/decks/CreateDeckSheet.tsx`
- `src/components/decks/DeckFilters.tsx`

#### 3.3 Edit/Delete Deck
- [ ] Edit deck modal (reuse create form)
- [ ] Delete with confirmation

---

### Phase 4: Settings

#### 4.1 Settings Screen
- [ ] Replace placeholder with full settings UI
- [ ] Theme selector (Light/Dark/System)
- [ ] Language selector (Arabic/English)
- [ ] Flashcard settings:
  - Show reverse flashcards toggle
  - Antonyms display mode (Hidden/Hint/Answer)
- [ ] Delete dictionary (with confirmation)
- [ ] Logout button (already in drawer, maybe keep there)

**Files to modify:**
- `src/app/(search)/settings.tsx`

**Files to reuse:**
- `src/components/SettingsScreen.tsx` (already exists, needs integration)

---

### Phase 5: Animations & Polish

#### 5.1 Page Transitions
- [ ] Add enter/exit animations to screens
- [ ] Stagger animations for list items

#### 5.2 List Animations
- [ ] Animate dictionary list items on load
- [ ] Animate item removal on delete
- [ ] Pull-to-refresh animation

#### 5.3 Flashcard Animations
- [ ] Already implemented - verify working correctly
- [ ] Grade feedback animations

#### 5.4 Micro-interactions
- [ ] Button press feedback
- [ ] Loading states
- [ ] Success/error toasts

**Libraries to use:**
- `react-native-reanimated` (already installed)
- `moti` (consider adding for easier animations)

---

### Phase 6: Cleanup

#### 6.1 Remove Meilisearch
- [ ] Search for any remaining Meilisearch imports
- [ ] Remove unused dependencies from package.json
- [ ] Clean up unused components

#### 6.2 Code Quality
- [ ] Run type-check and fix errors
- [ ] Run lint and fix issues
- [ ] Test all flows end-to-end

---

## File Structure Reference

```
src/
├── app/
│   ├── _layout.tsx                 # Root layout with providers
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── code/[email].tsx
│   └── (search)/
│       ├── _layout.tsx             # Drawer + search header
│       ├── decks.tsx               # Deck management
│       ├── settings.tsx            # Settings
│       └── (home)/
│           ├── _layout.tsx
│           ├── index.tsx           # Dictionary list + search
│           ├── add-word.tsx        # Add word form
│           └── edit-word/[id].tsx  # Edit word form (NEW)
├── components/
│   ├── dictionary/                 # NEW folder
│   │   ├── DictionaryList.tsx
│   │   ├── DictionaryEntryCard.tsx
│   │   ├── DictionaryEntrySheet.tsx
│   │   ├── DictionaryEmptyState.tsx
│   │   └── MorphologyDetails.tsx
│   ├── decks/                      # Existing, needs work
│   │   ├── DeckList.tsx
│   │   ├── DeckCard.tsx
│   │   ├── CreateDeckSheet.tsx
│   │   └── DeckFilters.tsx
│   ├── flashcard/                  # Existing, working
│   │   ├── FlashcardCard.tsx
│   │   ├── FlashcardReview.tsx
│   │   ├── GradeButtons.tsx
│   │   └── GradeFeedback.tsx
│   └── ui/                         # Existing
│       ├── button.tsx
│       ├── card.tsx
│       └── input.tsx
├── hooks/
│   ├── useAppInitialization.ts     # NEW
│   ├── useSearch.ts                # NEW - Orama search hook
│   └── useInfiniteScroll.ts        # NEW - pagination
├── lib/
│   ├── db/
│   │   ├── index.ts
│   │   ├── adapter.ts
│   │   └── operations/
│   └── search/
│       └── index.ts                # Orama integration
└── atoms/
    └── search.ts                   # NEW - search state atoms
```

---

## Web App Reference Files

Key files to reference when implementing:

| Feature | Web File Path |
|---------|---------------|
| Search hook | `apps/web/src/hooks/useSearch.ts` |
| Infinite scroll | `apps/web/src/hooks/useSearch.ts` (useInfiniteScroll) |
| Orama hydration | `apps/web/src/lib/search/index.ts` |
| Dictionary list | `apps/web/src/components/dictionary-entry.tsx` |
| Add/Edit word | `apps/web/src/routes/_authorized/dictionary/` |
| Flashcard review | `apps/web/src/components/flashcard-review/` |
| Deck management | `apps/web/src/routes/_authorized/decks.tsx` |
| Settings | `apps/web/src/routes/_authorized/settings.tsx` |
| DB operations | `apps/web/src/lib/db/operations/` |

---

## Progress Tracking

### Completed Tasks:
- [x] 1.1 Fix Safe Areas - Using useSafeAreaInsets hook
- [x] 1.2 Initialize Orama on App Startup - useAppInit hook created
- [x] 2.1 Dictionary List with Search - DictionaryList component
- [x] 2.2 Connect Search Bar - SearchContext in layout
- [x] 2.4 Edit Word Screen - edit-word/[id].tsx route created
- [x] 3.1-3.3 Deck Management - Full CRUD implemented
- [x] 4.1 Settings Screen - Theme, language, flashcard options
- [x] 6.1 Remove Meilisearch - No references in code

### Remaining Tasks:
- [ ] 2.3 Dictionary Entry Detail View (expansion works in card)
- [ ] 5.x Animations & Polish (basic animations added)
- [ ] Add-word form improvements (more fields)
- [ ] Type check and fix any errors

### Current Phase: Testing & Polish
### Current Task: Run type check and fix errors

---

## Notes

- User explicitly said NO import/export feature needed
- App should work completely offline (local-first)
- All styling with Uniwind (Tailwind v4 for React Native)
- Animations important for good UX
- RTL support for Arabic is critical

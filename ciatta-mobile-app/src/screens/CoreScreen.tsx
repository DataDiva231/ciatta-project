import React, { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme/tokens';
import { domainLabel, domains } from '../lib/mockData';
import type { Domain, Strength } from '../lib/types';
import type { DiscoveryRow } from '../lib/queries';
import ScreenContainer from '../components/ScreenContainer';
import EditorialHeader from '../components/EditorialHeader';
import BodySilhouette, {
  CORE_FIGURE_ASPECT,
  CORE_FIGURE_BASE_WIDTH,
} from '../components/BodySilhouette';
import Card from '../components/Card';

// Single-line empty-state/tap-hint text plus its own marginTop, and the
// `model` wrapper's marginVertical on both ends — the fixed cost around the
// silhouette that isn't itself figure height.
const TAP_HINT_BLOCK = 30;
const MODEL_MARGIN = 24;
// Safety ceiling only — the figure already renders wider than
// ScreenContainer's nominal content width at scale 1 without visibly
// clipping (nothing upstream clips horizontal overflow), so this exists to
// catch pathological cases (e.g. a very short window), not to shape normal
// growth the way a tight width-based cap would.
const MAX_SCALE = 1.8;

type Tab = 'discoveries' | 'unwritten';

export default function CoreScreen({
  onOpenUnderstanding,
  onOpenDiscovery,
  strengths,
  discoveries,
}: {
  onOpenUnderstanding: (domain: Domain) => void;
  onOpenDiscovery: (id: string) => void;
  strengths: Partial<Record<Domain, Strength>>;
  discoveries: DiscoveryRow[];
}) {
  const [tab, setTab] = useState<Tab>('discoveries');
  const understoodDomains = domains.filter((d) => strengths[d]);
  const unwrittenDomains = domains.filter((d) => !strengths[d]);

  // Core opens as an exploration of the body, not a dashboard: the title,
  // silhouette, and empty-state line fill the first screen on their own, and
  // Discoveries/Unwritten only appear once the user scrolls for them. This
  // reserves a minimum height for that intro group, derived from the actual
  // geometry rather than a guessed constant: ScreenContainer adds insets.top
  // + 20 of its own top padding before this block even starts, and the
  // floating nav's own footprint (its capsule height plus its safe-area
  // clearance) is what the block needs to clear at the bottom.
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const SCREEN_TOP_PADDING = 20; // ScreenContainer's own paddingTop, beyond insets.top
  const NAV_CAPSULE_HEIGHT = 62; // BottomNav's current (shortened) capsule height
  const NAV_BOTTOM_CLEARANCE = 2; // BottomNav dock's paddingBottom beyond insets.bottom
  const navFootprint = NAV_CAPSULE_HEIGHT + insets.bottom + NAV_BOTTOM_CLEARANCE;
  // Points *past* the exact nav-top boundary. The pill's corners are
  // strongly rounded, so its fill doesn't reach full width right at its top
  // edge — Discoveries/Unwritten needs to land further in, near the pill's
  // fuller-width vertical center, or its row peeks past the curve at the
  // sides even while nominally "under" the nav.
  const NAV_OVERLAP_COVERAGE = 8;
  const introMinHeight = Math.max(
    0,
    windowHeight - insets.top - SCREEN_TOP_PADDING - navFootprint + NAV_OVERLAP_COVERAGE
  );

  // The silhouette is the dominant element, not a fixed-size illustration:
  // its scale is solved so it fills whatever room is left in the intro block
  // after the (measured) header and the tap-hint line, so the label lands
  // right above the nav with minimal gap instead of leaving blank canvas.
  // Uniform scale keeps the body undistorted — stretching height only would
  // warp it — so it grows a little wider as it grows taller, capped by
  // MAX_SCALE as a safety ceiling rather than a tight width fit.
  const [headerHeight, setHeaderHeight] = useState(0);
  const availableModelHeight = Math.max(
    0,
    introMinHeight - headerHeight - TAP_HINT_BLOCK - MODEL_MARGIN
  );
  const scaleForHeight = availableModelHeight / (CORE_FIGURE_BASE_WIDTH * CORE_FIGURE_ASPECT);
  // Hold at 1 until the header's real height is known, so there's no flash
  // of an oversized figure before the first layout pass measures it.
  const silhouetteScale = headerHeight > 0 ? Math.min(scaleForHeight, MAX_SCALE) : 1;

  return (
    <ScreenContainer>
      <View style={{ minHeight: introMinHeight }}>
        <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
          <EditorialHeader title="Core" subtitle="Ciatta's understanding of you." />
        </View>

        <View style={styles.model}>
          <BodySilhouette
            variant="core"
            labeled
            marker="dot"
            strengths={strengths}
            onDomainPress={onOpenUnderstanding}
            scale={silhouetteScale}
          />
          <Text style={styles.tapHint}>
            {understoodDomains.length > 0
              ? 'Tap a point to explore your understandings'
              : "I don't have anything to show here yet."}
          </Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {(
          [
            ['discoveries', 'Discoveries'],
            ['unwritten', 'Unwritten'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <Text
            key={id}
            onPress={() => setTab(id)}
            style={[styles.tab, tab === id && styles.tabActive]}
          >
            {label}
          </Text>
        ))}
      </View>

      {tab === 'discoveries' &&
        (discoveries.length > 0 ? (
          <View style={styles.list}>
            {discoveries.map((disc) => (
              <Card key={disc.id} onPress={() => onOpenDiscovery(disc.id)}>
                <Text style={styles.rowTitle}>{disc.name ?? 'A new discovery'}</Text>
                <Text style={styles.rowSub}>{disc.narrative}</Text>
              </Card>
            ))}
          </View>
        ) : (
          <Card style={styles.list}>
            <Text style={styles.emptyText}>
              Nothing here yet. Discoveries appear once I've noticed a pattern
              strong enough to become part of your story.
            </Text>
          </Card>
        ))}

      {tab === 'unwritten' && (
        <View style={styles.list}>
          {unwrittenDomains.length > 0 ? (
            unwrittenDomains.map((d) => (
              <Card key={d} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{domainLabel[d]}</Text>
                  <Text style={styles.rowSub}>Not yet understood.</Text>
                </View>
              </Card>
            ))
          ) : (
            <Card>
              <Text style={styles.emptyText}>
                Everything I understand so far has a starting point. Nothing
                left unwritten.
              </Text>
            </Card>
          )}
        </View>
      )}

    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  model: {
    alignItems: 'center',
    marginVertical: 12,
  },
  tapHint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.ink3,
    marginTop: 8,
  },
  tabs: {
    flexDirection: 'row',
    gap: 22,
    marginTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
  },
  tab: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.ink3,
  },
  tabActive: {
    color: colors.ink,
    textDecorationLine: 'underline',
  },
  list: {
    marginTop: 18,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.ink,
  },
  rowSub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink2,
    marginTop: 3,
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink2,
  },
});

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import { domainLabel, domains } from '../lib/mockData';
import type { Domain, Strength } from '../lib/types';
import type { DiscoveryRow } from '../lib/queries';
import ScreenContainer from '../components/ScreenContainer';
import EditorialHeader from '../components/EditorialHeader';
import BodySilhouette from '../components/BodySilhouette';
import Card from '../components/Card';

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

  return (
    <ScreenContainer>
      <EditorialHeader title="Core" subtitle="Ciatta's understanding of you." />

      <View style={styles.model}>
        <BodySilhouette
          variant="core"
          labeled
          marker="dot"
          strengths={strengths}
          onDomainPress={onOpenUnderstanding}
        />
        <Text style={styles.tapHint}>
          {understoodDomains.length > 0
            ? 'Tap a point to explore your understandings'
            : "I don't have anything to show here yet."}
        </Text>
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

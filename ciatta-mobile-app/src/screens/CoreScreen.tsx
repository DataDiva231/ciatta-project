import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import { domainLabel, domains, evolutionStages, strengthLabel } from '../lib/mockData';
import type { Domain, Strength } from '../lib/types';
import type { DiscoveryRow } from '../lib/queries';
import ScreenContainer from '../components/ScreenContainer';
import EditorialHeader from '../components/EditorialHeader';
import BodySilhouette from '../components/BodySilhouette';
import EvolutionCard from '../components/EvolutionCard';
import Card from '../components/Card';
import { ChevronIcon } from '../components/icons';

type Tab = 'understandings' | 'discoveries' | 'unwritten';

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
  const [tab, setTab] = useState<Tab>('understandings');
  const understoodDomains = domains.filter((d) => strengths[d]);
  const unwrittenDomains = domains.filter((d) => !strengths[d]);

  return (
    <ScreenContainer>
      <EditorialHeader title="Core" subtitle="Ciatta's understanding of you." />

      <View style={styles.model}>
        <BodySilhouette
          variant="core"
          labeled
          strengths={strengths}
          onDomainPress={onOpenUnderstanding}
        />
        <Text style={styles.tapHint}>
          {understoodDomains.length > 0
            ? 'Tap anywhere to explore'
            : "I don't have anything to show here yet."}
        </Text>
      </View>

      <View style={styles.tabs}>
        {(
          [
            ['understandings', 'Understandings'],
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

      {tab === 'understandings' &&
        (understoodDomains.length > 0 ? (
          <View style={styles.list}>
            {understoodDomains.map((d) => (
              <Card key={d} onPress={() => onOpenUnderstanding(d)} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{domainLabel[d]}</Text>
                  <Text style={styles.rowSub}>{strengthLabel[strengths[d] as Strength]}</Text>
                </View>
                <ChevronIcon />
              </Card>
            ))}
          </View>
        ) : (
          <Card style={styles.list}>
            <Text style={styles.emptyText}>
              I don't have any understandings yet. As we spend time together,
              I'll start noticing patterns and sharing them here.
            </Text>
          </Card>
        ))}

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

      <Text style={[styles.label, { marginTop: 32 }]}>UNDERSTANDING EVOLUTION</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.evolutionRow}
      >
        {evolutionStages.map((stage) => (
          <EvolutionCard
            key={stage.id}
            label={stage.label}
            caption={stage.caption}
            stage={stage.density as 0 | 1 | 2 | 3}
          />
        ))}
      </ScrollView>
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
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.1,
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
  evolutionRow: {
    flexDirection: 'row',
    gap: 18,
    paddingTop: 14,
    paddingRight: 10,
  },
});
